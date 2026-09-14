import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

type Field = {
  id: string;
  name: string;
  crop_type: string | null;
  acres: number | null;
  soil_type: string | null;
};

type ActiveFieldContextValue = {
  fields: Field[];
  activeFieldId: string;
  activeField: Field | null;
  setActiveFieldId: (id: string) => void;
  loadingFields: boolean;
  refreshFields: () => Promise<void>;
};

const ActiveFieldContext = createContext<ActiveFieldContextValue | null>(null);
const STORAGE_KEY = "agritracker-active-field";

export function ActiveFieldProvider({ children }: { children: React.ReactNode }) {
  const [fields, setFields] = useState<Field[]>([]);
  const [activeFieldId, setActiveFieldIdState] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [loadingFields, setLoadingFields] = useState(true);

  const refreshFields = async () => {
    const { data, error } = await supabase
      .from("fields")
      .select("id, name, crop_type, acres, soil_type")
      .order("name", { ascending: true });
    if (error) {
      console.error("Failed to load active fields:", error);
      return;
    }
    const nextFields = data || [];
    setFields(nextFields);
    setActiveFieldIdState((current) => nextFields.some((field) => field.id === current) ? current : nextFields[0]?.id || "");
  };

  useEffect(() => {
    refreshFields().finally(() => setLoadingFields(false));
  }, []);

  useEffect(() => {
    if (activeFieldId) localStorage.setItem(STORAGE_KEY, activeFieldId);
    else localStorage.removeItem(STORAGE_KEY);
  }, [activeFieldId]);

  const value = useMemo(() => ({
    fields,
    activeFieldId,
    activeField: fields.find((field) => field.id === activeFieldId) || null,
    setActiveFieldId: (id: string) => setActiveFieldIdState(id),
    loadingFields,
    refreshFields,
  }), [fields, activeFieldId, loadingFields]);

  return <ActiveFieldContext.Provider value={value}>{children}</ActiveFieldContext.Provider>;
}

export function useActiveField() {
  const context = useContext(ActiveFieldContext);
  if (!context) throw new Error("useActiveField must be used inside ActiveFieldProvider");
  return context;
}
