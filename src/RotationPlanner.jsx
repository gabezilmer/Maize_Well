import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";
import { CROP_OPTIONS, CROP_COLORS } from "./lib/cropStyles";
import { Loader2, Plus, Trash2, Calendar, Sprout, History, TrendingUp, Pencil, Check, X } from "lucide-react";

const SEASONS = ["Full Year", "Spring", "Summer", "Fall", "Winter"];
const STATUSES = ["planned", "planted", "harvested"];
const STATUS_STYLES = {
  planned: "bg-amber-50 text-amber-700 border-amber-200",
  planted: "bg-sky-50 text-sky-700 border-sky-200",
  harvested: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
const STATUS_ICONS = {
  planned: Calendar,
  planted: Sprout,
  harvested: TrendingUp,
};

const emptyForm = {
  year: new Date().getFullYear(),
  season: "Full Year",
  crop_type: "Corn",
  status: "planned",
  notes: "",
};

export default function RotationPlanner({ showToast, fieldId }) {
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [rotations, setRotations] = useState([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [loadingRotations, setLoadingRotations] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const loadFields = useCallback(async () => {
    const { data, error } = await supabase
      .from("fields")
      .select("id, name, crop_type, acres")
      .order("created_at", { ascending: false });
    if (error) {
      showToast?.(`Failed to load fields: ${error.message}`, "error");
      return [];
    }
    setFields(data || []);
    return data || [];
  }, [showToast]);

  const loadRotations = useCallback(async (fieldId) => {
    if (!fieldId) {
      setRotations([]);
      return;
    }
    setLoadingRotations(true);
    const { data, error } = await supabase
      .from("crop_rotations")
      .select("id, year, season, crop_type, status, notes, created_at, updated_at")
      .eq("field_id", fieldId)
      .order("year", { ascending: false });
    if (error) {
      showToast?.(`Failed to load rotation history: ${error.message}`, "error");
      setRotations([]);
    } else {
      setRotations(data || []);
    }
    setLoadingRotations(false);
  }, [showToast]);

  useEffect(() => {
    loadFields().then((f) => {
      if (f.length > 0) setSelectedFieldId(fieldId || f[0].id);
      setLoadingFields(false);
    });
  }, [loadFields, fieldId]);

  useEffect(() => {
    if (selectedFieldId) {
      loadRotations(selectedFieldId);
    } else {
      setRotations([]);
    }
  }, [selectedFieldId, loadRotations]);

  const handleAdd = () => {
    setForm({ ...emptyForm, year: new Date().getFullYear() });
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
      year: Number(form.year),
      season: form.season,
      crop_type: form.crop_type,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    const { error } = await supabase.from("crop_rotations").insert([payload]);
    setSaving(false);
    if (error) {
      const msg = error.code === "23505"
        ? `An entry already exists for ${form.year} ${form.season}. Edit it instead.`
        : `Save failed: ${error.message}`;
      showToast?.(msg, "error");
      return;
    }
    showToast?.("Rotation entry added.");
    setShowForm(false);
    await loadRotations(selectedFieldId);
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditForm({
      year: r.year,
      season: r.season,
      crop_type: r.crop_type,
      status: r.status,
      notes: r.notes || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleUpdate = async (id) => {
    const payload = {
      year: Number(editForm.year),
      season: editForm.season,
      crop_type: editForm.crop_type,
      status: editForm.status,
      notes: editForm.notes.trim() || null,
    };
    const { error } = await supabase.from("crop_rotations").update(payload).eq("id", id);
    if (error) {
      const msg = error.code === "23505"
        ? `An entry already exists for ${payload.year} ${payload.season}.`
        : `Update failed: ${error.message}`;
      showToast?.(msg, "error");
      return;
    }
    showToast?.("Rotation entry updated.");
    setEditingId(null);
    setEditForm({});
    await loadRotations(selectedFieldId);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    const { error } = await supabase.from("crop_rotations").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      showToast?.(`Delete failed: ${error.message}`, "error");
      return;
    }
    showToast?.("Rotation entry deleted.");
    await loadRotations(selectedFieldId);
  };

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  // Group rotations by year for the timeline
  const yearGroups = [];
  const yearMap = {};
  rotations.forEach((r) => {
    if (!yearMap[r.year]) {
      yearMap[r.year] = { year: r.year, entries: [] };
      yearGroups.push(yearMap[r.year]);
    }
    yearMap[r.year].entries.push(r);
  });
  yearGroups.sort((a, b) => b.year - a.year);

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-stone-800">Crop Rotation & Season Planner</h2>
        <p className="text-stone-500">Log past crops and plan future seasons for each field.</p>
      </header>

      {loadingFields ? (
        <div className="flex items-center justify-center gap-3 py-20 text-stone-500">
          <Loader2 className="animate-spin" size={24} /> Loading fields...
        </div>
      ) : fields.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-12 flex flex-col items-center text-center text-stone-500">
          <History size={40} className="text-stone-300 mb-3" />
          <p className="text-lg font-medium">No fields saved yet</p>
          <p className="text-sm">Draw a field boundary on the Overview map first, then plan your rotations here.</p>
        </div>
      ) : (
        <>
          {/* Field selector + add button */}
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
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
                <Plus size={18} /> Add Rotation Entry
              </button>
            </div>
          </div>

          {/* Add form */}
          {showForm && (
            <form
              onSubmit={handleSave}
              className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 space-y-4"
            >
              <h3 className="text-lg font-semibold text-stone-800">
                New Rotation Entry{selectedField ? ` — ${selectedField.name}` : ""}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField label="Year">
                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </FormField>
                <FormField label="Season">
                  <select
                    value={form.season}
                    onChange={(e) => setForm({ ...form, season: e.target.value })}
                    className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    {SEASONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Crop">
                  <select
                    value={form.crop_type}
                    onChange={(e) => setForm({ ...form, crop_type: e.target.value })}
                    className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    {CROP_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
              <FormField label="Notes (optional)">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Yield notes, weather observations, etc."
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
                  Add Entry
                </button>
              </div>
            </form>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center gap-2">
              <History size={18} className="text-stone-400" />
              <h3 className="font-semibold text-stone-700">Rotation Timeline</h3>
              <span className="text-sm text-stone-400">({rotations.length} entries)</span>
            </div>

            {loadingRotations ? (
              <div className="flex items-center justify-center gap-3 py-16 text-stone-500">
                <Loader2 className="animate-spin" size={22} /> Loading rotation history...
              </div>
            ) : rotations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-stone-500">
                <History size={36} className="text-stone-300" />
                <p className="font-medium">No rotation history yet</p>
                <p className="text-sm">Click "Add Rotation Entry" to log a past crop or plan a future season.</p>
              </div>
            ) : (
              <div className="p-6">
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-stone-200" />

                  <div className="space-y-6">
                    {yearGroups.map((group) => {
                      const isPast = group.year < currentYear;
                      const isCurrent = group.year === currentYear;
                      return (
                        <div key={group.year} className="relative pl-10">
                          {/* Year marker */}
                          <div
                            className={`absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                              isCurrent
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : isPast
                                ? "bg-stone-100 text-stone-500 border-stone-300"
                                : "bg-amber-50 text-amber-700 border-amber-300"
                            }`}
                          >
                            {String(group.year).slice(-2)}
                          </div>

                          <div className="flex items-center gap-2 mb-3">
                            <h4 className="text-lg font-semibold text-stone-800">{group.year}</h4>
                            {isCurrent && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                Current Season
                              </span>
                            )}
                            {isPast && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">
                                Past
                              </span>
                            )}
                            {!isPast && !isCurrent && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                Planned
                              </span>
                            )}
                          </div>

                          {/* Season entries for this year */}
                          <div className="space-y-2">
                            {group.entries.map((r) => {
                              const style = CROP_COLORS[r.crop_type];
                              const StatusIcon = STATUS_ICONS[r.status];
                              const isEditing = editingId === r.id;

                              if (isEditing) {
                                return (
                                  <div
                                    key={r.id}
                                    className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 space-y-3"
                                  >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                      <FormField label="Year">
                                        <input
                                          type="number"
                                          min="1900"
                                          max="2100"
                                          value={editForm.year}
                                          onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                                          className="w-full p-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
                                        />
                                      </FormField>
                                      <FormField label="Season">
                                        <select
                                          value={editForm.season}
                                          onChange={(e) => setEditForm({ ...editForm, season: e.target.value })}
                                          className="w-full p-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-sm"
                                        >
                                          {SEASONS.map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                          ))}
                                        </select>
                                      </FormField>
                                      <FormField label="Crop">
                                        <select
                                          value={editForm.crop_type}
                                          onChange={(e) => setEditForm({ ...editForm, crop_type: e.target.value })}
                                          className="w-full p-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-sm"
                                        >
                                          {CROP_OPTIONS.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                          ))}
                                        </select>
                                      </FormField>
                                      <FormField label="Status">
                                        <select
                                          value={editForm.status}
                                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                          className="w-full p-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-sm"
                                        >
                                          {STATUSES.map((s) => (
                                            <option key={s} value={s}>
                                              {s.charAt(0).toUpperCase() + s.slice(1)}
                                            </option>
                                          ))}
                                        </select>
                                      </FormField>
                                    </div>
                                    <FormField label="Notes">
                                      <textarea
                                        value={editForm.notes}
                                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                        rows={2}
                                        className="w-full p-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none text-sm"
                                      />
                                    </FormField>
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={cancelEdit}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors text-sm font-medium"
                                      >
                                        <X size={15} /> Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdate(r.id)}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-sm font-medium"
                                      >
                                        <Check size={15} /> Save
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={r.id}
                                  className="flex items-center gap-3 rounded-lg border border-stone-100 p-3 hover:border-stone-200 hover:bg-stone-50/50 transition-colors group"
                                >
                                  {/* Season label */}
                                  <span className="text-sm text-stone-500 w-20 shrink-0">{r.season}</span>

                                  {/* Crop badge */}
                                  <span
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border"
                                    style={{
                                      backgroundColor: style?.fillColor ? `${style.fillColor}33` : "#f0fdf4",
                                      color: style?.color || "#059669",
                                      borderColor: style?.color ? `${style.color}33` : "#86efac",
                                    }}
                                  >
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style?.fillColor || "#10b981" }} />
                                    {r.crop_type}
                                  </span>

                                  {/* Status badge */}
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[r.status]}`}>
                                    <StatusIcon size={12} />
                                    {r.status}
                                  </span>

                                  {/* Notes */}
                                  {r.notes && (
                                    <span className="text-sm text-stone-400 truncate flex-1 hidden sm:block">{r.notes}</span>
                                  )}

                                  {/* Actions */}
                                  <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => startEdit(r)}
                                      className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 transition-colors"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={deletingId === r.id}
                                      onClick={() => handleDelete(r.id)}
                                      className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                                    >
                                      {deletingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
