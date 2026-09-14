import { getGeoJSONCenter } from "./soilLookup";

export interface WeatherSummary {
  condition: string;
  avgTempF: number;
  totalPrecipIn: number;
  maxTempF: number;
  minTempF: number;
  dryDays: number;
  heavyRainDays: number;
  heatWaveDays: number;
  detail: string;
}

/**
 * Fetches the last 14 days of weather history for a field's coordinates using
 * the free Open-Meteo API (no API key required). Returns a concise summary
 * suitable for inclusion in the diagnostic payload, or null on failure.
 */
export async function fetchWeatherForField(
  geojson: unknown,
): Promise<WeatherSummary | null> {
  const center = getGeoJSONCenter(geojson);
  if (!center) return null;

  return fetchWeatherSummary(center.lat, center.lon);
}

export async function fetchWeatherSummary(
  lat: number,
  lon: number,
): Promise<WeatherSummary | null> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "temperature_2m_mean",
      "precipitation_sum",
      "et0_fao_evapotranspiration",
    ].join(","),
    past_days: "14",
    forecast_days: "0",
    temperature_unit: "fahrenheit",
    precipitation_unit: "inch",
    timezone: "auto",
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("Open-Meteo request failed:", res.status);
      return null;
    }

    const data = await res.json();
    const daily = data?.daily;
    if (!daily || !Array.isArray(daily.time) || daily.time.length === 0) return null;

    const tMax: number[] = daily.temperature_2m_max ?? [];
    const tMin: number[] = daily.temperature_2m_min ?? [];
    const tMean: number[] = daily.temperature_2m_mean ?? [];
    const precip: number[] = daily.precipitation_sum ?? [];
    const et0: number[] = daily.et0_fao_evapotranspiration ?? [];

    const days = daily.time.length;
    let totalPrecip = 0;
    let tempSum = 0;
    let maxTemp = -Infinity;
    let minTemp = Infinity;
    let dryDays = 0;
    let heavyRainDays = 0;
    let heatWaveDays = 0;

    for (let i = 0; i < days; i++) {
      const p = precip[i] ?? 0;
      const tMaxI = tMax[i] ?? 0;
      const tMinI = tMin[i] ?? 0;
      const tMeanI = tMean[i] ?? 0;

      totalPrecip += p;
      tempSum += tMeanI;
      if (tMaxI > maxTemp) maxTemp = tMaxI;
      if (tMinI < minTemp) minTemp = tMinI;
      if (p < 0.1) dryDays++;
      if (p >= 1.0) heavyRainDays++;
      if (tMaxI >= 90) heatWaveDays++;
    }

    const avgTemp = tempSum / days;
    const totalET = et0.reduce((a: number, b: number) => a + (b ?? 0), 0);
    const waterBalance = totalPrecip - totalET;

    let condition: string;
    if (waterBalance < -2 || dryDays >= 10) {
      condition = "Dry";
    } else if (heavyRainDays >= 3 || waterBalance > 2) {
      condition = "Wet";
    } else if (heatWaveDays >= 3) {
      condition = "Hot";
    } else {
      condition = "Normal";
    }

    const detail =
      `14-day summary: ${condition}. Avg temp ${Math.round(avgTemp)}°F ` +
      `(range ${Math.round(minTemp)}–${Math.round(maxTemp)}°F). ` +
      `Total precip ${totalPrecip.toFixed(1)} in over ${days} days ` +
      `(${dryDays} dry days, ${heavyRainDays} heavy-rain days, ${heatWaveDays} days ≥90°F). ` +
      `Water balance (precip − ET₀): ${waterBalance.toFixed(1)} in.`;

    return {
      condition,
      avgTempF: Math.round(avgTemp),
      totalPrecipIn: Number(totalPrecip.toFixed(1)),
      maxTempF: Math.round(maxTemp),
      minTempF: Math.round(minTemp),
      dryDays,
      heavyRainDays,
      heatWaveDays,
      detail,
    };
  } catch (err) {
    console.warn("Weather lookup error:", err);
    return null;
  }
}
