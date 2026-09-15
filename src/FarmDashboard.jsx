import React, { useState, useEffect } from "react";
import area from "@turf/area";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { MapContainer, TileLayer, FeatureGroup, GeoJSON } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import { fetchFarmsWithFields } from "./fetchFarmData";
import { supabase } from "./lib/supabase";
import { Beaker, Leaf, AlertTriangle } from "lucide-react";
import { CROP_OPTIONS, styleForCrop } from "./lib/cropStyles";
import WeatherWidget from "./WeatherWidget";
import { getGeoJSONCenter, lookupSoilType } from "./lib/soilLookup";
import { lookupTopography } from "./lib/topographyLookup";

export default function FarmDashboard({ showToast, onFieldsChanged }) {
  const [farms, setFarms] = useState([]);
  const [savedFields, setSavedFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [symptom, setSymptom] = useState("");
  const [activeTab, setActiveTab] = useState("chemical");
  const [pendingGeoJSON, setPendingGeoJSON] = useState(null);
  const [fieldName, setFieldName] = useState("");
  const [cropType, setCropType] = useState("");
  const [pendingAcres, setPendingAcres] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadSavedFields = async () => {
    const { data, error } = await supabase.from("fields").select("id, name, crop_type, acres, geojson, soil_type, soil_source, min_elevation, max_elevation, elevation_change, dominant_aspect, created_at").order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to load saved fields:", error);
      showToast?.(`Load failed: ${error.message}`, "error");
      return [];
    }
    setSavedFields(data || []);
    return data || [];
  };

  useEffect(() => {
    Promise.all([
      fetchFarmsWithFields().then((data) => setFarms(data)).catch((err) => console.error("Failed to load farms:", err)),
      loadSavedFields(),
    ]).finally(() => setLoading(false));
  }, []);

  const handleCreated = (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    const layer = e.layer;
    const geoJSON = layer.toGeoJSON();
    const acres = area(geoJSON) / 4046.8564224;
    setPendingGeoJSON(geoJSON);
    setPendingAcres(Number(acres.toFixed(2)));
    setFieldName("");
    setCropType("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!pendingGeoJSON || !fieldName.trim()) return;

    setSaving(true);
    try {
      const center = getGeoJSONCenter(pendingGeoJSON);
      let soilType = null;
      let soilSource = null;
      let topography = null;
      if (center) {
        showToast?.("Identifying soil type from USDA SSURGO...");
        const soil = await lookupSoilType(center.lat, center.lon);
        if (soil) {
          soilType = soil.soil_type;
          soilSource = soil.source;
        }
      }
      showToast?.("Sampling field elevation and topography...");
      topography = await lookupTopography(pendingGeoJSON);

      const row = {
        name: fieldName.trim(),
        geojson: pendingGeoJSON,
        crop_type: cropType || null,
        acres: pendingAcres,
        soil_type: soilType,
        soil_source: soilSource,
        min_elevation: topography?.min_elevation ?? null,
        max_elevation: topography?.max_elevation ?? null,
        elevation_change: topography?.elevation_change ?? null,
        dominant_aspect: topography?.dominant_aspect ?? null,
      };
      const { error } = await supabase
        .from("fields")
        .insert([row])
        .select();
      if (error) throw error;
      if (soilType) {
        showToast?.(`Field "${fieldName.trim()}" saved — soil: ${soilType} (${soilSource})`);
      } else {
        showToast?.(`Field "${fieldName.trim()}" saved (soil type unavailable)`);
      }
      setPendingGeoJSON(null);
      setFieldName("");
      setCropType("");
      setPendingAcres(null);
      await loadSavedFields();
      onFieldsChanged?.();
    } catch (err) {
      console.error("Save failed:", err);
      const msg = err?.message || JSON.stringify(err);
      showToast?.(`Save failed: ${msg}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setPendingGeoJSON(null);
    setFieldName("");
    setCropType("");
    setPendingAcres(null);
  };

  return (
    <>
      <header className="mb-8">
          <h2 className="text-3xl font-bold text-stone-800">Field Overview</h2>
          <p className="text-stone-500">Manage your farm boundaries and history.</p>
        </header>

        {/* Map + Weather layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-stone-200">
            <h3 className="text-xl font-semibold mb-4">Field Boundary Map</h3>
            {loading ? (
              <p className="text-stone-500">Loading fields...</p>
            ) : (
              <p className="text-stone-500 text-sm">Draw a polygon on the map to create a new field boundary.</p>
            )}
            <MapContainer
              center={[45.0794, -93.9876]}
              zoom={13}
              className="h-96 w-full rounded-lg z-0"
              style={{ height: "500px", width: "100%" }}
            >
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
              {savedFields.map((field) => (
                <GeoJSON
                  key={field.id}
                  data={field.geojson}
                  style={{ weight: 2, ...styleForCrop(field.crop_type) }}
                />
              ))}
              <FeatureGroup>
                <EditControl
                  onCreated={handleCreated}
                  draw={{
                    polygon: { allowIntersection: true },
                    polyline: false,
                    circle: false,
                    rectangle: false,
                    circlemarker: false,
                    marker: false,
                  }}
                />
              </FeatureGroup>
            </MapContainer>
          </div>

          <div className="lg:col-span-1">
            <WeatherWidget showToast={showToast} />
          </div>
        </div>

        {/* Diagnostic Tool */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="text-amber-500" /> AI Diagnostic Engine
          </h3>
          <div className="flex gap-4 mb-6">
            <input
              type="text"
              placeholder="Describe the issue (e.g., 'yellowing corn leaves')..."
              className="flex-1 p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
            />
            <button type="button" className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors font-medium">
              Analyze
            </button>
          </div>

          {/* Solution Tabs */}
          <div className="border border-stone-200 rounded-lg overflow-hidden">
            <div className="flex border-b border-stone-200 bg-stone-50">
              <button
                type="button"
                onClick={() => setActiveTab("chemical")}
                className={`flex-1 p-3 font-medium flex items-center justify-center gap-2 ${activeTab === "chemical" ? "bg-white text-stone-800 border-b-2 border-blue-500" : "text-stone-500 hover:text-stone-700"}`}
              >
                <Beaker size={18} /> Chemical Solutions
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("sustainable")}
                className={`flex-1 p-3 font-medium flex items-center justify-center gap-2 ${activeTab === "sustainable" ? "bg-white text-stone-800 border-b-2 border-emerald-500" : "text-stone-500 hover:text-stone-700"}`}
              >
                <Leaf size={18} /> Sustainable Solutions
              </button>
            </div>
            <div className="p-6 bg-white text-stone-600">
              {activeTab === "chemical" ? (
                <p>Output from EPA/Pesticide registry will appear here.</p>
              ) : (
                <p>Output from OpenAccess scientific literature will appear here.</p>
              )}
            </div>
          </div>
        </div>

      {pendingGeoJSON && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Name Your Field</h3>
            <form onSubmit={handleSave}>
              <input
                type="text"
                autoFocus
                placeholder="e.g., North Pasture, Field A1..."
                className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none mb-4"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
              />
              <label className="block text-sm font-medium text-stone-700 mb-1">Crop/Perennial Type</label>
              <select
                value={cropType}
                onChange={(e) => setCropType(e.target.value)}
                className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none mb-4 bg-white"
              >
                <option value="">Select a crop type...</option>
                {CROP_OPTIONS.map((crop) => (
                  <option key={crop} value={crop}>{crop}</option>
                ))}
              </select>
              <div className="mb-4 rounded-lg bg-stone-50 border border-stone-200 px-3 py-2 text-sm text-stone-600">
                Calculated area: <span className="font-semibold text-stone-800">{pendingAcres?.toFixed(2)} acres</span>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !fieldName.trim()}
                  className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Save Field"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
