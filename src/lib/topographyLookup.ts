import { supabase } from "./supabase";

export interface TopographySummary {
  min_elevation: number;
  max_elevation: number;
  elevation_change: number;
  dominant_aspect: string;
  sample_count: number;
}

export async function lookupTopography(geojson: unknown): Promise<TopographySummary | null> {
  try {
    const { data, error } = await supabase.functions.invoke("topography-lookup", {
      body: { geojson },
    });
    if (error || !data || typeof data.min_elevation !== "number") return null;
    return data as TopographySummary;
  } catch (error) {
    console.warn("Topography lookup failed:", error);
    return null;
  }
}
