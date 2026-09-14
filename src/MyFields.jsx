import React, { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { Trash2, Sprout, Loader2, MapPin, Calendar, Layers, Mountain, RefreshCw } from "lucide-react";
import { lookupSoilForField } from "./lib/soilLookup";

export default function MyFields({ showToast, onOpenField, onFieldsChanged }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [refreshingId, setRefreshingId] = useState(null);

  const loadFields = async () => {
    const { data, error } = await supabase
      .from("fields")
      .select("id, name, crop_type, acres, soil_type, soil_source, min_elevation, max_elevation, elevation_change, dominant_aspect, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to load fields:", error);
      showToast?.(`Load failed: ${error.message}`, "error");
      return [];
    }
    setFields(data || []);
    return data || [];
  };

  useEffect(() => {
    loadFields().finally(() => setLoading(false));
  }, []);

  const handleRefreshSoil = async (id, name) => {
    setRefreshingId(id);
    try {
      showToast?.(`Looking up soil type for "${name}"...`);
      const soil = await lookupSoilForField(id);
      if (!soil) {
        showToast?.(`Could not identify soil for "${name}".`, "error");
        return;
      }
      const { error } = await supabase
        .from("fields")
        .update({ soil_type: soil.soil_type, soil_source: soil.source })
        .eq("id", id);
      if (error) throw error;
      setFields((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, soil_type: soil.soil_type, soil_source: soil.source }
            : f,
        ),
      );
      showToast?.(`Soil updated for "${name}": ${soil.soil_type} (${soil.source})`);
    } catch (err) {
      console.error("Soil refresh failed:", err);
      showToast?.(`Soil refresh failed: ${err.message}`, "error");
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDelete = async (id, name) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from("fields").delete().eq("id", id);
      if (error) throw error;
      setFields((prev) => prev.filter((f) => f.id !== id));
      showToast?.(`Field "${name}" deleted.`);
    } catch (err) {
      console.error("Delete failed:", err);
      showToast?.(`Delete failed: ${err.message}`, "error");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold text-stone-800">My Fields</h2>
        <p className="text-stone-500">View and manage your saved field boundaries.</p>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-stone-500">
            <Loader2 className="animate-spin" size={24} />
            Loading fields...
          </div>
        ) : fields.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-stone-500">
            <Sprout size={40} className="text-stone-300" />
            <p className="text-lg font-medium">No fields yet</p>
            <p className="text-sm">Draw a field boundary on the Overview map to get started.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-left text-stone-600">
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Crop Type</th>
                <th className="px-6 py-4 font-semibold">Acreage</th>
                <th className="px-6 py-4 font-semibold">Soil Type</th>
                <th className="px-6 py-4 font-semibold">Topography</th>
                <th className="px-6 py-4 font-semibold">Created</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr
                  key={field.id}
                  onClick={() => onOpenField?.(field.id)}
                  className="cursor-pointer border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <MapPin size={18} className="text-emerald-600" />
                      </div>
                      <span className="font-medium text-stone-800">{field.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {field.crop_type ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {field.crop_type}
                      </span>
                    ) : (
                      <span className="text-stone-400 text-sm italic">Not set</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {field.acres !== null && field.acres !== undefined ? (
                      <span className="font-semibold text-stone-800">{Number(field.acres).toFixed(2)} acres</span>
                    ) : (
                      <span className="text-stone-400 text-sm italic">Not calculated</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {field.soil_type ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1.5 text-sm text-stone-700">
                          <Layers size={14} className="text-amber-500" />
                          {field.soil_type}
                        </span>
                        {field.soil_source && (
                          <span className="text-xs text-stone-400 ml-5">{field.soil_source}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-stone-400 text-sm italic">Not identified</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {field.min_elevation !== null && field.min_elevation !== undefined ? (
                      <div className="flex items-start gap-2 text-sm">
                        <Mountain size={16} className="mt-0.5 text-sky-600" />
                        <div className="space-y-0.5">
                          <div className="font-medium text-stone-700">
                            {Number(field.min_elevation).toFixed(1)}–{Number(field.max_elevation).toFixed(1)} m
                          </div>
                          <div className="text-xs text-stone-500">
                            {Number(field.elevation_change).toFixed(1)} m change · {field.dominant_aspect || "Aspect unknown"}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-stone-400 text-sm italic">Not sampled</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-stone-600">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar size={15} className="text-stone-400" />
                      {formatDate(field.created_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={refreshingId === field.id}
                        onClick={(event) => { event.stopPropagation(); handleRefreshSoil(field.id, field.name); }}
                        title="Refresh soil data"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-amber-700 hover:bg-amber-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {refreshingId === field.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <RefreshCw size={16} />
                        )}
                        Refresh Soil
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === field.id}
                        onClick={(event) => { event.stopPropagation(); handleDelete(field.id, field.name); }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingId === field.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
