import React, { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Bot, ChevronDown, CloudSun, Mountain, Send, UserRound } from "lucide-react";
import { supabase } from "./lib/supabase";
import { fetchWeatherForField } from "./lib/weatherLookup";

function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Bot size={18} />
        </div>
      )}
      <div
        className={`max-w-3xl rounded-2xl px-4 py-3 text-sm leading-7 whitespace-pre-wrap ${
          isUser
            ? "rounded-br-md bg-emerald-700 text-white"
            : "rounded-bl-md border border-stone-200 bg-white text-stone-700 shadow-sm"
        }`}
      >
        {message.content}
        {message.source && (
          <p className="mt-3 border-t border-stone-200/70 pt-2 text-xs text-stone-400">
            Source: {message.source}
          </p>
        )}
      </div>
      {isUser && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-600">
          <UserRound size={17} />
        </div>
      )}
    </div>
  );
}

export default function Diagnostics({ showToast, fieldId }) {
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [symptom, setSymptom] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [loadingDiagnosis, setLoadingDiagnosis] = useState(false);
  const [error, setError] = useState("");
  const [weather, setWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadFields() {
      const { data, error: fieldsError } = await supabase
        .from("fields")
        .select("id, name, crop_type, soil_type, acres, min_elevation, max_elevation, elevation_change, dominant_aspect")
        .order("name", { ascending: true });

      if (!active) return;
      if (fieldsError) {
        setError("Your saved fields could not be loaded.");
        console.error("Failed to load diagnostic fields:", fieldsError);
      } else {
        setFields(data || []);
        if (fieldId && data?.some((field) => field.id === fieldId)) setSelectedFieldId(fieldId);
        else if (data?.[0]) setSelectedFieldId(data[0].id);
      }
      setLoadingFields(false);
    }

    loadFields();
    return () => {
      active = false;
    };
  }, [fieldId]);

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedFieldId) || null,
    [fields, selectedFieldId],
  );

  useEffect(() => {
    if (!selectedField) {
      setWeather(null);
      return;
    }
    let active = true;
    setLoadingWeather(true);
    supabase
      .from("fields")
      .select("geojson")
      .eq("id", selectedField.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!active || !data?.geojson) {
          if (active) setWeather(null);
          return;
        }
        const w = await fetchWeatherForField(data.geojson);
        if (active) setWeather(w);
      })
      .catch(() => { if (active) setWeather(null); })
      .finally(() => { if (active) setLoadingWeather(false); });
    return () => { active = false; };
  }, [selectedField]);

  const submitDiagnosis = async (event) => {
    event.preventDefault();
    const trimmedSymptom = symptom.trim();
    if (!selectedField || !trimmedSymptom || loadingDiagnosis) return;

    setLoadingDiagnosis(true);
    setError("");
    setMessages((current) => [...current, { role: "user", content: trimmedSymptom }]);
    setSymptom("");

    try {
      const [{ data: metrics, error: metricsError }, { data: history, error: historyError }] = await Promise.all([
        supabase
          .from("soil_metrics")
          .select("ph, organic_matter_pct, soil_moisture_pct, tested_at")
          .eq("field_id", selectedField.id)
          .order("tested_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("crop_rotations")
          .select("year, season, crop_type, status")
          .eq("field_id", selectedField.id)
          .order("year", { ascending: false }),
      ]);

      if (metricsError) throw metricsError;
      if (historyError) throw historyError;

      let weatherSummary = null;
      try {
        const { data: fieldGeo } = await supabase
          .from("fields")
          .select("geojson")
          .eq("id", selectedField.id)
          .maybeSingle();
        if (fieldGeo?.geojson) {
          weatherSummary = await fetchWeatherForField(fieldGeo.geojson);
        }
      } catch (weatherErr) {
        console.warn("Weather fetch failed for diagnostic payload:", weatherErr);
      }

      const fieldContext = {
        field_name: selectedField.name,
        crop_type: selectedField.crop_type,
        soil_type: selectedField.soil_type,
        acres: selectedField.acres,
        soil_metrics: metrics || null,
        crop_history: history || [],
        weather: weatherSummary,
        topography: selectedField.min_elevation !== null && selectedField.min_elevation !== undefined
          ? {
              min_elevation_m: selectedField.min_elevation,
              max_elevation_m: selectedField.max_elevation,
              elevation_change_m: selectedField.elevation_change,
              dominant_aspect: selectedField.dominant_aspect,
            }
          : null,
      };

      const { data, error: diagnosticError } = await supabase.functions.invoke("agronomy-diagnostic", {
        body: { field_context: fieldContext, symptom: trimmedSymptom },
      });

      if (diagnosticError) throw diagnosticError;
      if (!data?.diagnosis) throw new Error("The diagnostic service returned no diagnosis.");

      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.diagnosis, source: data.source },
      ]);
    } catch (diagnosticError) {
      console.error("Diagnostic request failed:", diagnosticError);
      const message = "The diagnosis could not be completed. Please try again.";
      setError(message);
      showToast?.(message, "error");
    } finally {
      setLoadingDiagnosis(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Activity size={23} />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Field intelligence</p>
            <h2 className="text-3xl font-bold tracking-tight text-stone-900">Diagnostics</h2>
          </div>
        </div>
        <p className="max-w-2xl text-stone-500">
          Ask about a crop symptom and get a diagnosis grounded in your field records, soil data, and Extension-backed agronomy.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <label htmlFor="diagnostic-field" className="mb-2 block text-sm font-semibold text-stone-800">
            Choose a field
          </label>
          <div className="relative">
            <select
              id="diagnostic-field"
              value={selectedFieldId}
              onChange={(event) => setSelectedFieldId(event.target.value)}
              disabled={loadingFields || fields.length === 0}
              className="w-full appearance-none rounded-xl border border-stone-300 bg-stone-50 px-3 py-3 pr-9 text-sm text-stone-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {fields.length === 0 && <option value="">No saved fields</option>}
              {fields.map((field) => (
                <option key={field.id} value={field.id}>{field.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3.5 text-stone-400" size={17} />
          </div>

          {selectedField ? (
            <div className="mt-5 space-y-3 border-t border-stone-100 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Context included</p>
              <div className="space-y-2 text-sm">
                <p><span className="text-stone-400">Crop:</span> <span className="font-medium text-stone-700">{selectedField.crop_type || "Not specified"}</span></p>
                <p><span className="text-stone-400">Soil:</span> <span className="font-medium text-stone-700">{selectedField.soil_type || "Not identified"}</span></p>
                <p><span className="text-stone-400">Area:</span> <span className="font-medium text-stone-700">{selectedField.acres ? `${selectedField.acres} acres` : "Not specified"}</span></p>
              </div>

              <div className="space-y-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <Mountain size={15} className="text-stone-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-700">Topography</span>
                </div>
                {selectedField.min_elevation !== null && selectedField.min_elevation !== undefined ? (
                  <>
                    <p className="text-sm font-medium text-stone-700">
                      {Number(selectedField.min_elevation).toFixed(1)}–{Number(selectedField.max_elevation).toFixed(1)} m elevation
                    </p>
                    <p className="text-xs leading-5 text-stone-500">
                      {Number(selectedField.elevation_change).toFixed(1)} m change · {selectedField.dominant_aspect || "Aspect unknown"}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-stone-400">Topography not sampled</p>
                )}
              </div>

              <div className="space-y-1.5 rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <CloudSun size={15} className="text-sky-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-sky-700">Recent Weather</span>
                </div>
                {loadingWeather ? (
                  <p className="text-xs text-stone-400">Fetching last 14 days...</p>
                ) : weather ? (
                  <>
                    <p className="text-sm font-medium text-stone-700">
                      {weather.condition}, Avg {weather.avgTempF}°F
                    </p>
                    <p className="text-xs leading-5 text-stone-500">
                      {weather.totalPrecipIn} in precip · {weather.dryDays} dry days · {weather.heatWaveDays} hot days
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-stone-400">Weather unavailable</p>
                )}
              </div>

              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
                Each question also includes the latest soil test, crop rotation history, and local weather.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-lg bg-amber-50 p-3 text-sm leading-5 text-amber-800">
              Draw and save a field before starting a diagnosis.
            </div>
          )}
        </aside>

        <section className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm">
          <div className="border-b border-stone-200 bg-white px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-700 text-white">
                <Bot size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900">Agronomy advisor</h3>
                <p className="text-xs text-stone-500">Certified-agronomist diagnostic guidance</p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {messages.length === 0 && (
              <div className="flex h-full min-h-[390px] flex-col items-center justify-center px-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700">
                  <Bot size={30} />
                </div>
                <h3 className="text-xl font-semibold text-stone-900">What are you seeing in the field?</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-stone-500">
                  Describe the symptom, where it appears on the plant, and when you first noticed it. Your field context will be added automatically.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {["Why are my corn leaves turning yellow at the edges?", "Why are my plants wilting?", "What is causing brown spots on my leaves?"] .map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setSymptom(prompt)}
                      className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600 transition hover:border-emerald-300 hover:text-emerald-700"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, index) => <MessageBubble key={`${message.role}-${index}`} message={message} />)}
            {loadingDiagnosis && (
              <div className="flex items-center gap-3 text-sm text-stone-500">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Bot size={18} /></div>
                <div className="rounded-2xl rounded-bl-md border border-stone-200 bg-white px-4 py-3 shadow-sm">Analyzing field conditions...</div>
              </div>
            )}
          </div>

          {error && (
            <div className="mx-5 mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submitDiagnosis} className="border-t border-stone-200 bg-white p-4">
            <div className="flex items-end gap-3 rounded-2xl border border-stone-300 bg-stone-50 p-2 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
              <textarea
                rows={2}
                value={symptom}
                onChange={(event) => setSymptom(event.target.value)}
                disabled={!selectedField || loadingDiagnosis}
                placeholder={selectedField ? "Describe what you are seeing..." : "Select a saved field first"}
                className="min-h-[48px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-stone-800 outline-none placeholder:text-stone-400 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!selectedField || !symptom.trim() || loadingDiagnosis}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Submit diagnosis question"
              >
                <Send size={18} />
              </button>
            </div>
            <p className="mt-2 px-2 text-[11px] text-stone-400">For field management decisions, confirm recommendations with local Extension or a certified crop advisor.</p>
          </form>
        </section>
      </div>
    </div>
  );
}
