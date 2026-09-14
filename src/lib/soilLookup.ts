import { supabase } from "./supabase";

/**
 * Extracts the centroid (lat, lon) from a GeoJSON Polygon or MultiPolygon.
 * Uses a simple area-weighted average of ring vertices.
 */
export function getGeoJSONCenter(geojson: unknown): { lat: number; lon: number } | null {
  if (!geojson || typeof geojson !== "object") return null;

  let gj = geojson as { type?: string; coordinates?: unknown; geometry?: unknown };

  // Unwrap GeoJSON Feature objects
  if (gj.type === "Feature" && gj.geometry && typeof gj.geometry === "object") {
    gj = gj.geometry as { type?: string; coordinates?: unknown };
  }

  if (!gj.type || !gj.coordinates) return null;

  let rings: number[][][] = [];

  if (gj.type === "Polygon") {
    rings = gj.coordinates as number[][][];
  } else if (gj.type === "MultiPolygon") {
    // Pick the largest polygon by vertex count
    const polys = gj.coordinates as number[][][][];
    if (polys.length === 0) return null;
    rings = polys.reduce((largest, poly) =>
      (poly[0]?.length || 0) > (largest[0]?.length || 0) ? poly : largest,
    );
  } else {
    return null;
  }

  if (rings.length === 0 || rings[0].length === 0) return null;

  const ring = rings[0];
  let latSum = 0;
  let lonSum = 0;
  let areaSum = 0;

  // Area-weighted centroid using the shoelace formula
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const cross = x1 * y2 - x2 * y1;
    latSum += (y1 + y2) * cross;
    lonSum += (x1 + x2) * cross;
    areaSum += cross;
  }

  if (areaSum === 0) {
    // Fallback to simple average if degenerate
    const n = ring.length - 1;
    const avg = ring.slice(0, n).reduce(
      (acc, [x, y]) => ({ lon: acc.lon + x, lat: acc.lat + y }),
      { lon: 0, lat: 0 },
    );
    return { lat: avg.lat / n, lon: avg.lon / n };
  }

  const factor = 1 / (3 * areaSum);
  return {
    lat: latSum * factor,
    lon: lonSum * factor,
  };
}

export interface SoilLookupResult {
  soil_type: string;
  source: string;
}

/**
 * Extracts the geometry object from a stored GeoJSON value, which may be
 * either a bare geometry (Polygon/MultiPolygon) or a Feature wrapping one.
 */
function extractGeometry(geojson: unknown): { lat: number; lon: number } | null {
  return getGeoJSONCenter(geojson);
}

/**
 * Looks up soil type for an existing field by its ID. Reads the field's
 * GeoJSON from the database, extracts the centroid, and calls the edge
 * function. Returns the result or null on failure.
 */
export async function lookupSoilForField(
  fieldId: string,
): Promise<SoilLookupResult | null> {
  const { data, error } = await supabase
    .from("fields")
    .select("geojson")
    .eq("id", fieldId)
    .maybeSingle();

  if (error || !data?.geojson) return null;

  const center = extractGeometry(data.geojson);
  if (!center) return null;

  return lookupSoilType(center.lat, center.lon);
}

/**
 * Calls the soil-lookup edge function to identify the soil type at a given
 * coordinate. Returns null if the lookup fails — the caller should treat
 * this as "soil type unavailable" rather than blocking the save.
 */
export async function lookupSoilType(
  lat: number,
  lon: number,
): Promise<SoilLookupResult | null> {
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/soil-lookup`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ lat, lon }),
    });

    if (!res.ok) {
      console.warn("Soil lookup failed:", res.status);
      return null;
    }

    const data = await res.json();
    if (data && typeof data.soil_type === "string" && data.soil_type) {
      return { soil_type: data.soil_type, source: data.source || "Unknown" };
    }

    return null;
  } catch (err) {
    console.warn("Soil lookup error:", err);
    return null;
  }
}
