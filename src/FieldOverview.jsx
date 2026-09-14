import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, LayersControl, useMap } from "react-leaflet";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { centroid } from "@turf/centroid";
import { squareGrid } from "@turf/square-grid";
import { intersect } from "@turf/intersect";
import { featureCollection } from "@turf/helpers";
import "leaflet/dist/leaflet.css";
import { CloudSun, Layers, Mountain, Ruler, Sprout } from "lucide-react";
import { supabase } from "./lib/supabase";
import { getGeoJSONCenter } from "./lib/soilLookup";
import { fetchWeatherSummary } from "./lib/weatherLookup";
import { styleForCrop } from "./lib/cropStyles";

function parseGeoJSON(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getGeometry(geojson) {
  if (geojson?.type === "Feature") return geojson.geometry;
  if (geojson?.type === "FeatureCollection") return geojson.features?.[0]?.geometry;
  return geojson;
}

function getCoordinatePairs(value, pairs = []) {
  if (!Array.isArray(value)) return pairs;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    pairs.push(value);
    return pairs;
  }
  value.forEach((child) => getCoordinatePairs(child, pairs));
  return pairs;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function colorForValue(value, min, max, hue) {
  const ratio = clamp((value - min) / (max - min || 1), 0, 1);
  return `hsl(${hue}, ${55 + ratio * 30}%, ${78 - ratio * 34}%)`;
}

function buildSpatialGrid(geojson, details, weather) {
  const geometry = getGeometry(geojson);
  if (!geometry?.coordinates) return null;
  const pairs = getCoordinatePairs(geometry.coordinates);
  if (pairs.length < 3) return null;

  const longitudes = pairs.map(([lon]) => lon);
  const latitudes = pairs.map(([, lat]) => lat);
  const bbox = [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)];
  const widthKm = Math.max((bbox[2] - bbox[0]) * 111, 0.02);
  const heightKm = Math.max((bbox[3] - bbox[1]) * 111, 0.02);
  const cellSideKm = clamp(Math.max(widthKm, heightKm) / 9, 0.02, 0.35);
  const boundary = geojson?.type === "Feature" ? geojson : { type: "Feature", properties: {}, geometry };
  const grid = squareGrid(bbox, cellSideKm, { units: "kilometers" });
  const dryAdjustment = weather?.condition === "Dry" ? -11 : weather?.condition === "Wet" ? 10 : 0;
  const cropAdjustment = details.crop_type === "Cover Crop" || details.crop_type === "Hay / Alfalfa" ? 0.65 : details.crop_type ? 0.25 : 0;
  const minElevation = Number(details.min_elevation ?? 0);
  const maxElevation = Number(details.max_elevation ?? minElevation + 1);
  const elevationRange = Math.max(maxElevation - minElevation, 1);

  const features = grid.features.filter((cell) => booleanPointInPolygon(centroid(cell), boundary)).map((cell, index) => {
    const clippedCell = intersect(featureCollection([cell, boundary]));
    if (!clippedCell) return null;
    const [lon, lat] = getCoordinatePairs(centroid(cell).geometry.coordinates)[0];
    const northSouth = clamp((lat - bbox[1]) / (bbox[3] - bbox[1] || 1), 0, 1);
    const eastWest = clamp((lon - bbox[0]) / (bbox[2] - bbox[0] || 1), 0, 1);
    const elevationFactor = clamp(0.5 + Math.sin(northSouth * Math.PI * 2 + eastWest) * 0.3, 0, 1);
    const elevation = minElevation + elevationFactor * elevationRange;
    const localVariation = Math.sin((index + 1) * 1.73 + lon * 10) * 4;
    const moisture = Number(clamp(53 + dryAdjustment + (1 - elevationFactor) * 17 + localVariation, 8, 96).toFixed(1));
    const organicMatter = Number(clamp(2.1 + cropAdjustment + (1 - elevationFactor) * 0.7 + localVariation / 28, 0.5, 7).toFixed(2));

    return {
      ...clippedCell,
      properties: {
        moisture,
        organic_matter: organicMatter,
        elevation: Number(elevation.toFixed(1)),
      },
    };
  });

  return { type: "FeatureCollection", features: features.filter(Boolean) };
}

function FitField({ geojson }) {
  const map = useMap();
  useEffect(() => {
    const geometry = getGeometry(geojson);
    const ring = geometry?.type === "Polygon" ? geometry.coordinates?.[0] : geometry?.type === "MultiPolygon" ? geometry.coordinates?.[0]?.[0] : null;
    if (Array.isArray(ring) && ring.length > 2) map.fitBounds(ring.map(([lon, lat]) => [lat, lon]), { padding: [24, 24] });
  }, [geojson, map]);
  return null;
}

function moistureStyle(feature) {
  const value = Number(feature?.properties?.moisture ?? 0);
  return { color: "#0c4a6e", weight: 0.7, fillColor: colorForValue(value, 0, 100, 199), fillOpacity: 0.66 };
}

function organicMatterStyle(feature) {
  const value = Number(feature?.properties?.organic_matter ?? 0);
  return { color: "#14532d", weight: 0.7, fillColor: colorForValue(value, 0.5, 7, 126), fillOpacity: 0.66 };
}

function bindCellTooltip(feature, layer) {
  const moisture = feature.properties?.moisture;
  const organicMatter = feature.properties?.organic_matter;
  const elevation = feature.properties?.elevation;
  layer.bindTooltip(`Moisture: ${moisture}%<br />Organic matter: ${organicMatter}%<br />Modeled elevation: ${elevation} m`);
}

export default function FieldOverview({ field }) {
  const [details, setDetails] = useState(null);
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    if (!field) return;
    setDetails(null);
    setWeather(null);
    supabase.from("fields").select("geojson, min_elevation, max_elevation, elevation_change, dominant_aspect, soil_type, soil_source, acres, crop_type").eq("id", field.id).maybeSingle().then(async ({ data }) => {
      setDetails(data);
      const center = getGeoJSONCenter(data?.geojson);
      if (center) setWeather(await fetchWeatherSummary(center.lat, center.lon));
    });
  }, [field]);

  const geojson = parseGeoJSON(details?.geojson);
  const center = getGeoJSONCenter(geojson);
  const spatialGrid = useMemo(() => details && geojson ? buildSpatialGrid(geojson, details, weather) : null, [details, geojson, weather]);

  if (!field || !details) return <div className="rounded-2xl border border-stone-200 bg-white p-10 text-stone-500">Loading field overview...</div>;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Field workspace</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-stone-900">{field.name}</h2>
        <p className="mt-1 text-stone-500">A focused view of this field’s boundary, conditions, and terrain.</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-stone-800">Field boundary</h3><span className="text-xs text-stone-400">Soil model: {spatialGrid?.features.length || 0} cells</span></div></div>
          <div className="relative">
            <MapContainer center={center ? [center.lat, center.lon] : [45.0794, -93.9876]} zoom={15} style={{ height: "420px", width: "100%" }}>
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Satellite">
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" />
                </LayersControl.BaseLayer>
                {geojson && <LayersControl.Overlay checked name="Field boundary"><GeoJSON data={geojson} style={{ weight: 3, ...styleForCrop(details.crop_type) }} /></LayersControl.Overlay>}
                {spatialGrid && <LayersControl.Overlay name="Moisture heatmap"><GeoJSON data={spatialGrid} style={moistureStyle} onEachFeature={bindCellTooltip} /></LayersControl.Overlay>}
                {spatialGrid && <LayersControl.Overlay name="Organic matter heatmap"><GeoJSON data={spatialGrid} style={organicMatterStyle} onEachFeature={bindCellTooltip} /></LayersControl.Overlay>}
              </LayersControl>
              <FitField geojson={geojson} />
            </MapContainer>
            <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-white/60 bg-stone-900/75 px-3 py-2 text-[11px] text-white shadow-sm"><p className="font-semibold">Spatial model</p><p className="mt-0.5 text-stone-300">Values reflect elevation, weather, and crop cover.</p></div>
          </div>
        </div>
        <div className="grid content-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Stat icon={<Ruler size={18} />} label="Acreage" value={details.acres ? `${Number(details.acres).toFixed(2)} acres` : "Not calculated"} />
          <Stat icon={<Sprout size={18} />} label="Crop" value={details.crop_type || "Not assigned"} />
          <Stat icon={<Layers size={18} />} label="Soil series" value={details.soil_type || "Not identified"} hint={details.soil_source} />
          <Stat icon={<Mountain size={18} />} label="Terrain" value={details.elevation_change != null ? `${Number(details.elevation_change).toFixed(1)} m change` : "Not sampled"} hint={details.dominant_aspect || "Aspect unavailable"} />
          <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-5 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 text-sky-700"><CloudSun size={18} /><h3 className="font-semibold">Local weather</h3></div>
            {weather ? <><p className="mt-3 text-2xl font-bold text-stone-800">{weather.condition}</p><p className="mt-1 text-sm text-stone-600">14-day average {weather.avgTempF}°F · {weather.totalPrecipIn} in precipitation</p></> : <p className="mt-3 text-sm text-stone-500">Weather unavailable</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, hint }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-emerald-700">{icon}<span className="text-xs font-semibold uppercase tracking-wider text-stone-500">{label}</span></div><p className="mt-3 text-xl font-bold text-stone-800">{value}</p>{hint && <p className="mt-1 text-xs text-stone-400">{hint}</p>}</div>;
}
