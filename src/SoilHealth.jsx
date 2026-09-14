import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";
import { CROP_OPTIONS } from "./lib/cropStyles";
import { Activity, Loader2, Plus, Trash2, FlaskConical, Droplets, Leaf, Calendar, Layers, RefreshCw } from "lucide-react";
import { lookupSoilForField } from "./lib/soilLookup";

const emptyForm = {
  ph: "",
  organic_matter_pct: "",
  soil_moisture_pct: "",
  notes: "",
  tested_at: new Date().toISOString().slice(0, 10),
};

export default function SoilHealth({ showToast, fieldId }) {
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [metrics, setMetrics] = useState([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [refreshingSoil, setRefreshingSoil] = useState(false);

  const loadFields = useCallback(async () => {
    const { data, error } = await supabase
      .from("fields")
      .select("id, name, crop_type, acres, soil_type, soil_source")
      .order("created_at", { ascending: false });
    if (error) {
      showToast?.(`Failed to load fields: ${error.message}`, "error");
      return [];
    }
    setFields(data || []);
    return data || [];
  }, [showToast]);

  const loadMetrics = useCallback(async (fieldId) => {
    if (!fieldId) {
      setMetrics([]);
      return;
    }
    setLoadingMetrics(true);
    const { data, error } = await supabase
      .from("soil_metrics")
      .select("id, ph, organic_matter_pct, soil_moisture_pct, notes, tested_at, created_at")
      .eq("field_id", fieldId)
      .order("tested_at", { ascending: false });
    if (error) {
      showToast?.(`Failed to load soil data: ${error.message}`, "error");
      setMetrics([]);
    } else {
      setMetrics(data || []);
    }
    setLoadingMetrics(false);
  }, [showToast]);

  useEffect(() => {
    loadFields().then((f) => {
      if (f.length > 0) {
        setSelectedFieldId(fieldId || f[0].id);
      }
      setLoadingFields(false);
    });
  }, [loadFields, fieldId]);

  useEffect(() => {
    if (selectedFieldId) {
      loadMetrics(selectedFieldId);
    } else {
      setMetrics([]);
    }
  }, [selectedFieldId, loadMetrics]);

  const handleAdd = () => {
    setForm({ ...emptyForm, tested_at: new Date().toISOString().slice(0, 10) });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedFieldId) {
      showToast?.("Select a field first.", "error");
      return;
    }
    setSaving(true);
    const payload = {
      field_id: selectedFieldId,
      ph: form.ph === "" ? null : Number(form.ph),
      organic_matter_pct: form.organic_matter_pct === "" ? null : Number(form.organic_matter_pct),
      soil_moisture_pct: form.soil_moisture_pct === "" ? null : Number(form.soil_moisture_pct),
      notes: form.notes.trim() || null,
      tested_at: form.tested_at ? new Date(form.tested_at).toISOString() : new Date().toISOString(),
    };
    const { error } = await supabase.from("soil_metrics").insert([payload]);
    setSaving(false);
    if (error) {
      showToast?.(`Save failed: ${error.message}`, "error");
      return;
    }
    showToast?.("Soil test recorded.");
    setShowForm(false);
    await loadMetrics(selectedFieldId);
  };

  const handleRefreshSoil = async () => {
    if (!selectedFieldId) return;
    setRefreshingSoil(true);
    try {
      showToast?.(`Looking up soil type for "${selectedField?.name}"...`);
      const soil = await lookupSoilForField(selectedFieldId);
      if (!soil) {
        showToast?.(`Could not identify soil for "${selectedField?.name}".`, "error");
        return;
      }
      const { error } = await supabase
        .from("fields")
        .update({ soil_type: soil.soil_type, soil_source: soil.source })
        .eq("id", selectedFieldId);
      if (error) throw error;
      setFields((prev) =>
        prev.map((f) =>
          f.id === selectedFieldId
            ? { ...f, soil_type: soil.soil_type, soil_source: soil.source }
            : f,
        ),
      );
      showToast?.(`Soil updated: ${soil.soil_type} (${soil.source})`);
    } catch (err) {
      console.error("Soil refresh failed:", err);
      showToast?.(`Soil refresh failed: ${err.message}`, "error");
    } finally {
      setRefreshingSoil(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    const { error } = await supabase.from("soil_metrics").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      showToast?.(`Delete failed: ${error.message}`, "error");
      return;
    }
    showToast?.("Soil test deleted.");
    await loadMetrics(selectedFieldId);
  };

  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const fmt = (val, unit = "") =>
    val !== null && val !== undefined ? `${Number(val).toFixed(2)}${unit}` : "—";

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  // Summary: latest reading per metric
  const latest = metrics.length > 0 ? metrics[0] : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-stone-800">Soil Health & Diagnostics</h2>
        <p className="text-stone-500">Log and track soil test results for each saved field.</p>
      </header>

      {loadingFields ? (
        <div className="flex items-center justify-center gap-3 py-20 text-stone-500">
          <Loader2 className="animate-spin" size={24} />
          Loading fields...
        </div>
      ) : fields.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-12 flex flex-col items-center text-center text-stone-500">
          <Activity size={40} className="text-stone-300 mb-3" />
          <p className="text-lg font-medium">No fields saved yet</p>
          <p className="text-sm">Draw a field boundary on the Overview map first, then come back here to log soil tests.</p>
        </div>
      ) : (
        <>
          {/* Field selector + summary cards */}
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex-1 min-w-[240px]">
                <label className="block text-sm font-medium text-stone-600 mb-1.5">Select Field</label>
                <select
                  value={selectedFieldId}
                  onChange={(e) => setSelectedFieldId(e.target.value)}
                  className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                      {f.crop_type ? ` — ${f.crop_type}` : ""}
                      {f.acres ? ` (${Number(f.acres).toFixed(1)} ac)` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleAdd}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Plus size={18} /> Log Soil Test
              </button>
            </div>

            {selectedField && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                  icon={<Layers size={18} />}
                  label="Soil Type"
                  value={selectedField.soil_type || "—"}
                  hint={selectedField.soil_source || "Not identified"}
                  accent="amber"
                  action={
                    <button
                      type="button"
                      disabled={refreshingSoil}
                      onClick={handleRefreshSoil}
                      title="Refresh soil data"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-amber-700 hover:bg-amber-50 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {refreshingSoil ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Refresh
                    </button>
                  }
                />
                <SummaryCard
                  icon={<FlaskConical size={18} />}
                  label="pH (latest)"
                  value={latest?.ph != null ? Number(latest.ph).toFixed(2) : "—"}
                  hint={latest ? formatDate(latest.tested_at) : "No data"}
                  accent="amber"
                />
                <SummaryCard
                  icon={<Leaf size={18} />}
                  label="Organic Matter"
                  value={latest?.organic_matter_pct != null ? `${Number(latest.organic_matter_pct).toFixed(2)}%` : "—"}
                  hint={latest ? formatDate(latest.tested_at) : "No data"}
                  accent="emerald"
                />
                <SummaryCard
                  icon={<Droplets size={18} />}
                  label="Soil Moisture"
                  value={latest?.soil_moisture_pct != null ? `${Number(latest.soil_moisture_pct).toFixed(2)}%` : "—"}
                  hint={latest ? formatDate(latest.tested_at) : "No data"}
                  accent="sky"
                />
              </div>
            )}
          </div>

          {/* Add form */}
          {showForm && (
            <form
              onSubmit={handleSave}
              className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 space-y-4"
            >
              <h3 className="text-lg font-semibold text-stone-800">
              New Soil Test{selectedField ? ` — ${selectedField.name}` : ""}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField label="pH" hint="0 – 14">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="14"
                    value={form.ph}
                    onChange={(e) => setForm({ ...form, ph: e.target.value })}
                    placeholder="6.5"
                    className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </FormField>
                <FormField label="Organic Matter (%)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.organic_matter_pct}
                    onChange={(e) => setForm({ ...form, organic_matter_pct: e.target.value })}
                    placeholder="3.2"
                    className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </FormField>
                <FormField label="Soil Moisture (%)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.soil_moisture_pct}
                    onChange={(e) => setForm({ ...form, soil_moisture_pct: e.target.value })}
                    placeholder="22.0"
                    className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </FormField>
                <FormField label="Test Date">
                  <input
                    type="date"
                    value={form.tested_at}
                    onChange={(e) => setForm({ ...form, tested_at: e.target.value })}
                    className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </FormField>
              </div>
              <FormField label="Notes (optional)">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Observations, lab name, etc."
                  className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
                />
              </FormField>
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Save Test
                </button>
              </div>
            </form>
          )}

          {/* History table */}
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center gap-2">
              <Activity size={18} className="text-stone-400" />
              <h3 className="font-semibold text-stone-700">Test History</h3>
              <span className="text-sm text-stone-400">({metrics.length})</span>
            </div>
            {loadingMetrics ? (
              <div className="flex items-center justify-center gap-3 py-16 text-stone-500">
                <Loader2 className="animate-spin" size={22} /> Loading soil data...
              </div>
            ) : metrics.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-stone-500">
                <FlaskConical size={36} className="text-stone-300" />
                <p className="font-medium">No soil tests logged yet</p>
                <p className="text-sm">Click "Log Soil Test" to add your first reading for this field.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-left text-stone-600 text-sm">
                      <th className="px-6 py-3 font-semibold">Test Date</th>
                      <th className="px-6 py-3 font-semibold">pH</th>
                      <th className="px-6 py-3 font-semibold">Organic Matter</th>
                      <th className="px-6 py-3 font-semibold">Soil Moisture</th>
                      <th className="px-6 py-3 font-semibold">Notes</th>
                      <th className="px-6 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((m) => (
                      <tr key={m.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors">
                        <td className="px-6 py-3 text-stone-600 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-stone-400" />
                            {formatDate(m.tested_at)}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-sm">{fmt(m.ph)}</td>
                        <td className="px-6 py-3 text-sm">{fmt(m.organic_matter_pct, "%")}</td>
                        <td className="px-6 py-3 text-sm">{fmt(m.soil_moisture_pct, "%")}</td>
                        <td className="px-6 py-3 text-sm text-stone-500 max-w-xs truncate">
                          {m.notes || <span className="text-stone-300 italic">—</span>}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <button
                            type="button"
                            disabled={deletingId === m.id}
                            onClick={() => handleDelete(m.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            {deletingId === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, hint, accent, action }) {
  const accents = {
    amber: "bg-amber-50 text-amber-600 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
    sky: "bg-sky-50 text-sky-600 border-sky-200",
  };
  return (
    <div className="rounded-xl border border-stone-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${accents[accent] || ""}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-stone-800 leading-tight truncate">{value}</p>
        <p className="text-xs text-stone-400 truncate">{hint}</p>
      </div>
      {action}
    </div>
  );
}

function FormField({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-600 mb-1.5">
        {label}
        {hint && <span className="text-stone-400 font-normal ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}
