import React, { useState } from "react";
import { Activity, BarChart3, ClipboardList, CloudSun, DollarSign, Layers3 } from "lucide-react";
import FieldOverview from "./FieldOverview";
import Diagnostics from "./Diagnostics";
import SoilHealth from "./SoilHealth";
import RotationPlanner from "./RotationPlanner";
import Financials from "./Financials";

const tabs = [
  { id: "overview", label: "Field Overview", icon: CloudSun },
  { id: "diagnostics", label: "Diagnostics", icon: Activity },
  { id: "soil", label: "Soil Health", icon: Layers3 },
  { id: "rotation", label: "Rotation Planner", icon: ClipboardList },
  { id: "financials", label: "Financials", icon: DollarSign },
];

export default function FieldWorkspace({ field, showToast }) {
  const [tab, setTab] = useState("overview");
  if (!field) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-amber-800">Select a field above to open its workspace.</div>;
  return <div className="space-y-6">
    <nav className="sticky top-0 z-10 -mx-8 border-b border-stone-200 bg-white/95 px-8 shadow-sm backdrop-blur">
      <div className="flex min-w-max gap-1 overflow-x-auto py-2">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${tab === id ? "bg-emerald-700 text-white shadow-sm" : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"}`}><Icon size={16} />{label}</button>)}
      </div>
    </nav>
    {tab === "overview" && <FieldOverview field={field} />}
    {tab === "diagnostics" && <Diagnostics showToast={showToast} fieldId={field.id} />}
    {tab === "soil" && <SoilHealth showToast={showToast} fieldId={field.id} />}
    {tab === "rotation" && <RotationPlanner showToast={showToast} fieldId={field.id} />}
    {tab === "financials" && <Financials showToast={showToast} fieldId={field.id} />}
  </div>;
}
