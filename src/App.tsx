import React, { useCallback, useState } from "react";
import { LayoutDashboard, Map, Settings, Sprout, ChevronDown } from "lucide-react";
import FarmDashboard from "./FarmDashboard";
import MyFields from "./MyFields";
import FieldWorkspace from "./FieldWorkspace";
import { ActiveFieldProvider, useActiveField } from "./ActiveFieldContext";

export default function App() {
  return <ActiveFieldProvider><AppShell /></ActiveFieldProvider>;
}

function AppShell() {
  const [view, setView] = useState("overview");
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const { fields, activeField, setActiveFieldId, refreshFields } = useActiveField();
  const showToast = useCallback((message: string, type: string = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);
  const openField = (id: string) => {
    setActiveFieldId(id);
    setView("workspace");
  };

  return <div className="flex min-h-screen bg-stone-50 font-sans text-stone-800">
    <aside className="hidden w-64 shrink-0 flex-col bg-stone-900 p-6 text-stone-200 md:flex">
      <button type="button" onClick={() => setView("overview")} className="mb-10 flex items-center gap-2 text-left text-2xl font-bold text-emerald-400"><Sprout />Maize Well</button>
      <nav className="space-y-2">
        <NavButton active={view === "overview"} icon={<LayoutDashboard size={19} />} onClick={() => setView("overview")}>All Fields / Overview</NavButton>
        <NavButton active={view === "my-fields"} icon={<Map size={19} />} onClick={() => setView("my-fields")}>My Fields</NavButton>
        <NavButton active={view === "settings"} icon={<Settings size={19} />} onClick={() => setView("settings")}>Settings</NavButton>
      </nav>
    </aside>
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur md:px-8">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Active field</p><p className="font-semibold text-stone-800">{activeField?.name || "Choose a field to open its workspace"}</p></div>
        <div className="relative min-w-[230px]">
          <select aria-label="Active Field" value={activeField?.id || ""} onChange={(event) => openField(event.target.value)} className="w-full appearance-none rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 pr-10 text-sm font-semibold text-stone-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
            {!fields.length && <option value="">No saved fields</option>}
            {fields.map((field) => <option key={field.id} value={field.id}>{field.name}{field.crop_type ? ` · ${field.crop_type}` : ""}</option>)}
          </select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 text-stone-400" size={17} />
        </div>
        <div className="flex w-full gap-2 overflow-x-auto md:hidden">
          {[{ id: "overview", label: "Overview" }, { id: "my-fields", label: "My Fields" }, { id: "settings", label: "Settings" }].map((item) => <button key={item.id} type="button" onClick={() => setView(item.id)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === item.id ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-600"}`}>{item.label}</button>)}
        </div>
      </header>
      <div className="p-5 md:p-8">
        {view === "overview" && <FarmDashboard showToast={showToast} onFieldsChanged={refreshFields} />}
        {view === "my-fields" && <MyFields showToast={showToast} onOpenField={openField} onFieldsChanged={refreshFields} />}
        {view === "workspace" && <FieldWorkspace field={activeField} showToast={showToast} />}
        {view === "settings" && <SettingsView />}
      </div>
    </main>
    {toast && <div className={`fixed bottom-6 right-6 z-[1000] rounded-xl px-5 py-3 font-medium text-white shadow-lg ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>{toast.message}</div>}
  </div>;
}

function NavButton({ active, icon, children, onClick }: { active: boolean; icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${active ? "bg-emerald-500/15 text-emerald-300" : "text-stone-400 hover:bg-white/5 hover:text-stone-100"}`}>{icon}{children}</button>;
}

function SettingsView() {
  return <div className="mx-auto max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Preferences</p><h2 className="mt-1 text-3xl font-bold text-stone-900">Settings</h2><div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><h3 className="font-semibold text-stone-800">Workspace preferences</h3><p className="mt-2 text-sm text-stone-500">Your active field selection is saved automatically on this device.</p></div></div>;
}
