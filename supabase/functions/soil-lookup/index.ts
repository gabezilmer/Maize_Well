const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SoilRequest {
  lat: number;
  lon: number;
}

interface SoilResult {
  soil_type: string;
  source: string;
}

/**
 * Local fallback lookup table for Wright County, Minnesota.
 * Coordinates the user's fields fall within (~45.05–45.14, -94.07 to -93.97).
 * Soil series common to this area: Clarion (well-drained uplands),
 * Nicollet (moderately drained till plains), Webster (poorly drained potholes).
 * The lookup uses a simple nearest-point approach against known soil map unit
 * centroids derived from SSURGO data for Wright County.
 */
interface SoilPoint {
  lat: number;
  lon: number;
  series: string;
  description: string;
}

const WRIGHT_COUNTY_SOILS: SoilPoint[] = [
  { lat: 45.0878, lon: -94.0175, series: "Clarion-Nicollet", description: "Clarion-Nicollet loams, 2 to 6 percent slopes" },
  { lat: 45.0916, lon: -93.9760, series: "Nicollet-Webster", description: "Nicollet-Webster clay loams, 0 to 2 percent slopes" },
  { lat: 45.0850, lon: -94.0200, series: "Clarion", description: "Clarion loam, 2 to 6 percent slopes" },
  { lat: 45.0920, lon: -93.9750, series: "Webster", description: "Webster clay loam, 0 to 1 percent slopes" },
  { lat: 45.0800, lon: -94.0100, series: "Nicollet", description: "Nicollet clay loam, 1 to 3 percent slopes" },
  { lat: 45.1000, lon: -94.0000, series: "Clarion", description: "Clarion loam, 1 to 5 percent slopes" },
  { lat: 45.0700, lon: -93.9900, series: "Webster", description: "Webster clay loam, 0 to 2 percent slopes" },
  { lat: 45.1100, lon: -94.0300, series: "Nicollet", description: "Nicollet clay loam, 0 to 2 percent slopes" },
  { lat: 45.0600, lon: -94.0400, series: "Clarion", description: "Clarion-Nicollet loams, 2 to 6 percent slopes" },
  { lat: 45.1200, lon: -93.9800, series: "Webster", description: "Webster-Nicollet clay loams, 0 to 2 percent slopes" },
];

// Wright County bounding box (approximate)
const WRIGHT_COUNTY_BBOX = {
  minLat: 45.0,
  maxLat: 45.2,
  minLon: -94.1,
  maxLon: -93.9,
};

function isInWrightCounty(lat: number, lon: number): boolean {
  return (
    lat >= WRIGHT_COUNTY_BBOX.minLat &&
    lat <= WRIGHT_COUNTY_BBOX.maxLat &&
    lon >= WRIGHT_COUNTY_BBOX.minLon &&
    lon <= WRIGHT_COUNTY_BBOX.maxLon
  );
}

function nearestWrightCountySoil(lat: number, lon: number): SoilResult {
  let nearest = WRIGHT_COUNTY_SOILS[0];
  let minDist = Infinity;

  for (const point of WRIGHT_COUNTY_SOILS) {
    const dLat = lat - point.lat;
    const dLon = lon - point.lon;
    const dist = dLat * dLat + dLon * dLon;
    if (dist < minDist) {
      minDist = dist;
      nearest = point;
    }
  }

  return {
    soil_type: nearest.description,
    source: "Wright County MN local lookup",
  };
}

/**
 * Queries USDA NRCS Soil Data Access (SDA) web service for the map unit
 * name at a given point. Uses the REST JSON endpoint with a timeout.
 */
async function fetchUSDA(lat: number, lon: number): Promise<SoilResult | null> {
  const query = `SELECT muname FROM mapunit mu
    JOIN component co ON mu.mukey = co.mukey
    WHERE mu.mukey IN (
      SELECT * FROM SDA_Get_Mukey_from_PointWithCrs(${lon.toFixed(6)}, ${lat.toFixed(6)}, 4326)
    )
    ORDER BY co.comppct_r DESC LIMIT 1`;

  const body = { query, format: "JSON" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(
      "https://sdmdataaccess.nrcs.usda.gov/Tabular/SDA-TabularService.asmx/RunQuery",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );

    if (!res.ok) throw new Error(`USDA SDA returned ${res.status}`);

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        data = JSON.parse(match[0]);
      } else {
        throw new Error("Could not parse USDA SDA response");
      }
    }

    const rows = Array.isArray(data) ? data : (data as { Table?: unknown[] })?.Table;
    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0] as unknown[];
      const muname = row[0];
      if (muname && typeof muname === "string" && muname.trim()) {
        return { soil_type: muname.trim(), source: "USDA SSURGO" };
      }
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fallback: queries ISRIC SoilGrids REST API for soil texture at the point.
 */
async function fetchSoilGrids(lat: number, lon: number): Promise<SoilResult | null> {
  const url =
    `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon.toFixed(6)}&lat=${lat.toFixed(6)}` +
    `&property=clay&property=sand&property=silt&depth=0-5cm&value=mean`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`SoilGrids returned ${res.status}`);

    const data = await res.json();
    const props = data?.properties?.layers?.[0]?.depths?.[0]?.values;
    if (!props) return null;

    const clay = props.mean ?? 0;
    const sand = data?.properties?.layers?.[1]?.depths?.[0]?.values?.mean ?? 0;
    const silt = data?.properties?.layers?.[2]?.depths?.[0]?.values?.mean ?? 0;

    if (clay + sand + silt === 0) return null;

    let texture: string;
    if (clay >= 40) texture = "Clay";
    else if (clay >= 27 && sand >= 20) texture = "Clay loam";
    else if (clay >= 27 && sand < 20) texture = "Silty clay loam";
    else if (clay >= 20 && sand >= 50) texture = "Sandy clay loam";
    else if (silt >= 50 && clay >= 12) texture = "Silty loam";
    else if (silt >= 80) texture = "Silt";
    else if (sand >= 50 && clay < 20) texture = "Sandy loam";
    else if (sand >= 85) texture = "Sand";
    else if (clay >= 7 && silt < 50 && sand < 52) texture = "Loam";
    else texture = "Loam";

    return { soil_type: `${texture} soil`, source: "SoilGrids" };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { lat, lon } = (await req.json()) as SoilRequest;

    if (typeof lat !== "number" || typeof lon !== "number") {
      return new Response(
        JSON.stringify({ error: "lat and lon are required as numbers" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let result: SoilResult | null = null;
    let lastError = "";

    // 1. Try USDA SSURGO first
    try {
      result = await fetchUSDA(lat, lon);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    // 2. Fallback to SoilGrids
    if (!result) {
      try {
        result = await fetchSoilGrids(lat, lon);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    // 3. Final fallback: Wright County local lookup
    if (!result && isInWrightCounty(lat, lon)) {
      result = nearestWrightCountySoil(lat, lon);
    }

    if (!result) {
      return new Response(
        JSON.stringify({ error: `Could not determine soil type: ${lastError}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
