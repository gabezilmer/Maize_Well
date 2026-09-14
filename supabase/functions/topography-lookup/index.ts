import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Coordinate = [number, number];
type Ring = Coordinate[];
type Polygon = Ring[];

type TopographyResult = {
  min_elevation: number;
  max_elevation: number;
  elevation_change: number;
  dominant_aspect: string;
  sample_count: number;
};

function extractPolygons(value: unknown): Polygon[] {
  if (!value || typeof value !== "object") return [];
  const geojson = value as { type?: string; coordinates?: unknown; geometry?: unknown };
  if (geojson.type === "Feature") return extractPolygons(geojson.geometry);
  if (geojson.type === "Polygon" && Array.isArray(geojson.coordinates)) {
    return [geojson.coordinates as Polygon];
  }
  if (geojson.type === "MultiPolygon" && Array.isArray(geojson.coordinates)) {
    return geojson.coordinates as Polygon[];
  }
  return [];
}

function pointInRing(point: Coordinate, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: Coordinate, polygon: Polygon): boolean {
  return polygon.length > 0 && pointInRing(point, polygon[0]) &&
    polygon.slice(1).every((hole) => !pointInRing(point, hole));
}

function samplePolygon(polygon: Polygon): Coordinate[] {
  const outer = polygon[0] || [];
  if (outer.length < 3) return [];
  const samples: Coordinate[] = [];
  const seen = new Set<string>();
  const add = (point: Coordinate) => {
    const key = `${point[0].toFixed(6)},${point[1].toFixed(6)}`;
    if (!seen.has(key)) {
      seen.add(key);
      samples.push(point);
    }
  };

  outer.forEach(add);
  const bounds = outer.reduce(
    (result, [lon, lat]) => ({
      minLon: Math.min(result.minLon, lon),
      maxLon: Math.max(result.maxLon, lon),
      minLat: Math.min(result.minLat, lat),
      maxLat: Math.max(result.maxLat, lat),
    }),
    { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity },
  );

  for (let row = 0; row < 5; row++) {
    for (let column = 0; column < 5; column++) {
      const point: Coordinate = [
        bounds.minLon + ((column + 0.5) / 5) * (bounds.maxLon - bounds.minLon),
        bounds.minLat + ((row + 0.5) / 5) * (bounds.maxLat - bounds.minLat),
      ];
      if (pointInPolygon(point, polygon)) add(point);
    }
  }
  return samples.slice(0, 45);
}

function getAspect(points: Array<{ point: Coordinate; elevation: number }>): string {
  if (points.length < 3) return "Unknown";
  const meanLon = points.reduce((sum, item) => sum + item.point[0], 0) / points.length;
  const meanLat = points.reduce((sum, item) => sum + item.point[1], 0) / points.length;
  const cosLat = Math.cos((meanLat * Math.PI) / 180);
  let xx = 0;
  let yy = 0;
  let xy = 0;
  let xz = 0;
  let yz = 0;

  for (const item of points) {
    const x = (item.point[0] - meanLon) * 111320 * cosLat;
    const y = (item.point[1] - meanLat) * 111320;
    const z = item.elevation;
    xx += x * x;
    yy += y * y;
    xy += x * y;
    xz += x * z;
    yz += y * z;
  }

  const determinant = xx * yy - xy * xy;
  if (Math.abs(determinant) < 0.000001) return "Unknown";
  const eastSlope = (xz * yy - yz * xy) / determinant;
  const northSlope = (yz * xx - xz * xy) / determinant;
  const downslopeEast = -eastSlope;
  const downslopeNorth = -northSlope;
  const slopeMagnitude = Math.hypot(downslopeEast, downslopeNorth);
  if (slopeMagnitude < 0.00001) return "Flat";

  const bearing = (Math.atan2(downslopeEast, downslopeNorth) * 180) / Math.PI;
  const normalizedBearing = (bearing + 360) % 360;
  const directions = ["North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"];
  return `${directions[Math.round(normalizedBearing / 45) % 8]}-facing`;
}

async function lookupElevations(locations: Coordinate[]): Promise<Array<{ point: Coordinate; elevation: number }>> {
  const response = await fetch("https://api.open-elevation.com/api/v1/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locations: locations.map(([longitude, latitude]) => ({ latitude, longitude })) }),
  });
  if (!response.ok) throw new Error(`Elevation service returned ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data?.results)) throw new Error("Elevation service returned an invalid response");
  return data.results
    .map((result: { elevation?: unknown }, index: number) => ({
      point: locations[index],
      elevation: Number(result.elevation),
    }))
    .filter((result: { elevation: number }) => Number.isFinite(result.elevation));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body = await req.json();
    const polygons = extractPolygons(body?.geojson);
    const locations = polygons.flatMap(samplePolygon);
    if (locations.length < 3) {
      return new Response(JSON.stringify({ error: "A valid polygon boundary is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const samples = await lookupElevations(locations);
    if (samples.length < 3) throw new Error("Not enough elevation points were returned");
    const elevations = samples.map((sample) => sample.elevation);
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    const result: TopographyResult = {
      min_elevation: Number(minElevation.toFixed(2)),
      max_elevation: Number(maxElevation.toFixed(2)),
      elevation_change: Number((maxElevation - minElevation).toFixed(2)),
      dominant_aspect: getAspect(samples),
      sample_count: samples.length,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Topography lookup failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
