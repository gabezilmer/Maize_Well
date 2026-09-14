import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";
import { CROP_YIELD_DATA, estimateFieldRevenue, estimateFieldYield, formatCurrency, formatNumber } from "./lib/cropYields";
import { CROP_COLORS } from "./lib/cropStyles";
import { Loader2, TrendingUp, Sprout, MapPin, DollarSign, Wheat } from "lucide-react";

/**
 * @typedef {{ id: string; name: string; crop_type: string | null; acres: number | null }} FieldRow
 * @typedef {{ crop: string; fields: number; acres: number; yield: number; revenue: number; unit: string }} CropAggregate
 */

export default function Financials({ showToast, fieldId }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    loadFields().finally(() => setLoading(false));
  }, [loadFields]);

  const scopedFields = fieldId ? fields.filter((field) => field.id === fieldId) : fields;
  const fieldsWithAcres = scopedFields.filter((f) => f.acres != null && f.acres > 0);
  const fieldsWithCrop = fieldsWithAcres.filter((f) => f.crop_type && f.crop_type !== "Other");
  const totalAcres = fieldsWithAcres.reduce((sum, f) => sum + (f.acres || 0), 0);
  const totalRevenue = fieldsWithCrop.reduce((sum, f) => sum + estimateFieldRevenue(f.acres, f.crop_type), 0);
  const totalYield = fieldsWithCrop.reduce((sum, f) => sum + estimateFieldYield(f.acres, f.crop_type), 0);

  // Aggregate by crop
  const cropMap = {};
  fieldsWithCrop.forEach((f) => {
    const crop = f.crop_type;
    if (!cropMap[crop]) {
      const yd = CROP_YIELD_DATA[crop];
      cropMap[crop] = {
        crop,
        fields: 0,
        acres: 0,
        yield: 0,
        revenue: 0,
        unit: yd?.unit || "",
      };
    }
    cropMap[crop].fields += 1;
    cropMap[crop].acres += f.acres || 0;
    cropMap[crop].yield += estimateFieldYield(f.acres, crop);
    cropMap[crop].revenue += estimateFieldRevenue(f.acres, crop);
  });
  const cropAggregates = Object.values(cropMap).sort((a, b) => b.revenue - a.revenue);

  // Max revenue for bar scaling
  const maxRevenue = cropAggregates.length > 0 ? cropAggregates[0].revenue : 1;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-stone-800">Financials & Yield Estimates</h2>
        <p className="text-stone-500">
          Projected revenue and yield based on saved field acreage and crop type, using standard U.S. average benchmarks.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-stone-500">
          <Loader2 className="animate-spin" size={24} /> Loading financial data...
        </div>
      ) : scopedFields.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-12 flex flex-col items-center text-center text-stone-500">
          <TrendingUp size={40} className="text-stone-300 mb-3" />
          <p className="text-lg font-medium">No field data available yet</p>
          <p className="text-sm">Draw a field boundary on the Overview map and assign a crop to see financial projections.</p>
        </div>
      ) : (
        <>
          {/* Top summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              icon={<MapPin size={18} />}
              label="Total Acreage"
              value={`${formatNumber(totalAcres, 1)} ac`}
              hint={`${fieldsWithAcres.length} of ${scopedFields.length} fields calculated`}
              accent="emerald"
            />
            <SummaryCard
              icon={<DollarSign size={18} />}
              label="Projected Revenue"
              value={formatCurrency(totalRevenue)}
              hint="Gross, all crops"
              accent="amber"
            />
            <SummaryCard
              icon={<Wheat size={18} />}
              label="Total Est. Yield"
              value={formatNumber(totalYield)}
              hint="Across all crops"
              accent="sky"
            />
            <SummaryCard
              icon={<Sprout size={18} />}
              label="Active Crops"
              value={String(cropAggregates.length)}
              hint={`${fieldsWithCrop.length} fields with crops`}
              accent="violet"
            />
          </div>

          {/* Revenue by crop breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <h3 className="font-semibold text-stone-700 mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-stone-400" /> Projected Revenue by Crop
            </h3>
            {cropAggregates.length === 0 ? (
              <div className="py-10 text-center text-stone-500">
                <Sprout size={32} className="text-stone-300 mx-auto mb-2" />
                <p className="text-sm">No assigned crop data is available for this field yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cropAggregates.map((agg) => {
                  const style = CROP_COLORS[agg.crop];
                  const barColor = style?.fillColor || "#10b981";
                  const widthPct = maxRevenue > 0 ? (agg.revenue / maxRevenue) * 100 : 0;
                  return (
                    <div key={agg.crop} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: barColor }} />
                          <span className="font-medium text-stone-700">{agg.crop}</span>
                          <span className="text-stone-400">
                            {agg.fields} field{agg.fields !== 1 ? "s" : ""} · {formatNumber(agg.acres, 1)} ac
                          </span>
                        </div>
                        <span className="font-semibold text-stone-800">{formatCurrency(agg.revenue)}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${widthPct}%`, backgroundColor: barColor }}
                        />
                      </div>
                      <p className="text-xs text-stone-400">
                        Est. yield: {formatNumber(agg.yield)} {agg.unit}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Per-field breakdown table */}
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200">
              <h3 className="font-semibold text-stone-700">Per-Field Estimates</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-left text-stone-600 text-sm">
                    <th className="px-6 py-3 font-semibold">Field</th>
                    <th className="px-6 py-3 font-semibold">Crop</th>
                    <th className="px-6 py-3 font-semibold text-right">Acres</th>
                    <th className="px-6 py-3 font-semibold text-right">Est. Yield</th>
                    <th className="px-6 py-3 font-semibold text-right">Est. Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedFields.map((f) => {
                    const acres = f.acres || 0;
                    const crop = f.crop_type;
                    const yd = crop && crop !== "Other" ? CROP_YIELD_DATA[crop] : null;
                    const yieldVal = yd ? estimateFieldYield(acres, crop) : 0;
                    const revVal = yd ? estimateFieldRevenue(acres, crop) : 0;
                    return (
                      <tr key={f.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors">
                        <td className="px-6 py-3">
                          <span className="font-medium text-stone-800">{f.name}</span>
                        </td>
                        <td className="px-6 py-3">
                          {crop ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {crop}
                            </span>
                          ) : (
                            <span className="text-stone-400 text-sm italic">Not set</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right text-sm text-stone-700">
                          {f.acres != null ? formatNumber(acres, 2) : <span className="text-stone-300 italic">—</span>}
                        </td>
                        <td className="px-6 py-3 text-right text-sm text-stone-700">
                          {yd ? `${formatNumber(yieldVal)} ${yd.unit}` : <span className="text-stone-300 italic">—</span>}
                        </td>
                        <td className="px-6 py-3 text-right text-sm font-semibold text-stone-800">
                          {yd ? formatCurrency(revVal) : <span className="text-stone-300 italic font-normal">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-stone-400 px-1">
            Estimates use standard U.S. average yield and price benchmarks for each crop type. Actual results vary with soil health, weather, inputs, and market conditions.
          </p>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, hint, accent }) {
  const accents = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200",
    sky: "bg-sky-50 text-sky-600 border-sky-200",
    violet: "bg-violet-50 text-violet-600 border-violet-200",
  };
  return (
    <div className="rounded-xl border border-stone-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${accents[accent] || ""}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-stone-800 leading-tight">{value}</p>
        <p className="text-xs text-stone-400">{hint}</p>
      </div>
    </div>
  );
}
