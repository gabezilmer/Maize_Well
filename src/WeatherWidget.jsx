import React, { useState, useEffect, useCallback } from "react";
import {
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  CloudSun,
  CloudFog,
  CloudLightning,
  Wind,
  Droplets,
  Eye,
  Gauge,
  Loader2,
  RefreshCw,
  MapPin,
  Sunrise,
  Sunset,
  Search,
  X,
  Crosshair,
} from "lucide-react";

// Default location: Maple Lake, Wright County, MN
const DEFAULT_LOCATION = {
  name: "Maple Lake, MN",
  lat: 45.0794,
  lon: -93.9876,
};

const STORAGE_KEY = "weather-location";

const WEATHER_CODES = {
  0: { label: "Clear sky", icon: Sun, day: "text-amber-500", night: "text-indigo-400" },
  1: { label: "Mainly clear", icon: CloudSun, day: "text-amber-400", night: "text-indigo-300" },
  2: { label: "Partly cloudy", icon: CloudSun, day: "text-stone-400", night: "text-indigo-300" },
  3: { label: "Overcast", icon: Cloud, day: "text-stone-400", night: "text-stone-500" },
  45: { label: "Fog", icon: CloudFog, day: "text-stone-400", night: "text-stone-500" },
  48: { label: "Rime fog", icon: CloudFog, day: "text-stone-400", night: "text-stone-500" },
  51: { label: "Light drizzle", icon: CloudRain, day: "text-sky-400", night: "text-sky-500" },
  53: { label: "Drizzle", icon: CloudRain, day: "text-sky-500", night: "text-sky-600" },
  55: { label: "Heavy drizzle", icon: CloudRain, day: "text-sky-500", night: "text-sky-600" },
  56: { label: "Freezing drizzle", icon: CloudRain, day: "text-sky-400", night: "text-sky-500" },
  57: { label: "Freezing drizzle", icon: CloudRain, day: "text-sky-400", night: "text-sky-500" },
  61: { label: "Light rain", icon: CloudRain, day: "text-sky-500", night: "text-sky-600" },
  63: { label: "Rain", icon: CloudRain, day: "text-sky-500", night: "text-sky-600" },
  65: { label: "Heavy rain", icon: CloudRain, day: "text-sky-600", night: "text-sky-700" },
  66: { label: "Freezing rain", icon: CloudRain, day: "text-sky-400", night: "text-sky-500" },
  67: { label: "Freezing rain", icon: CloudRain, day: "text-sky-400", night: "text-sky-500" },
  71: { label: "Light snow", icon: CloudSnow, day: "text-sky-300", night: "text-sky-400" },
  73: { label: "Snow", icon: CloudSnow, day: "text-sky-400", night: "text-sky-500" },
  75: { label: "Heavy snow", icon: CloudSnow, day: "text-sky-500", night: "text-sky-600" },
  77: { label: "Snow grains", icon: CloudSnow, day: "text-sky-300", night: "text-sky-400" },
  80: { label: "Light showers", icon: CloudRain, day: "text-sky-400", night: "text-sky-500" },
  81: { label: "Showers", icon: CloudRain, day: "text-sky-500", night: "text-sky-600" },
  82: { label: "Violent showers", icon: CloudRain, day: "text-sky-600", night: "text-sky-700" },
  85: { label: "Snow showers", icon: CloudSnow, day: "text-sky-400", night: "text-sky-500" },
  86: { label: "Snow showers", icon: CloudSnow, day: "text-sky-400", night: "text-sky-500" },
  95: { label: "Thunderstorm", icon: CloudLightning, day: "text-amber-500", night: "text-amber-400" },
  96: { label: "Thunderstorm + hail", icon: CloudLightning, day: "text-amber-500", night: "text-amber-400" },
  99: { label: "Thunderstorm + hail", icon: CloudLightning, day: "text-amber-500", night: "text-amber-400" },
};

function getWeatherInfo(code) {
  return WEATHER_CODES[code] || { label: "Unknown", icon: Cloud, day: "text-stone-400", night: "text-stone-500" };
}

function isDaytime(now, sunrise, sunset) {
  const cur = now.getTime();
  const rise = sunrise ? sunrise.getTime() : 0;
  const set = sunset ? sunset.getTime() : 0;
  return cur >= rise && cur < set;
}

function loadSavedLocation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.lat === "number" && typeof parsed.lon === "number" && parsed.name) {
        return parsed;
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return DEFAULT_LOCATION;
}

function saveLocation(loc) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {
    // ignore quota errors
  }
}

export default function WeatherWidget({ showToast }) {
  const [location, setLocation] = useState(loadSavedLocation);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Location search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const fetchWeather = useCallback(async (loc, silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setError(null);

    try {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${loc.lat}&longitude=${loc.lon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover,visibility` +
        `&hourly=precipitation_probability,temperature_2m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,wind_speed_10m_max` +
        `&timezone=America/Chicago` +
        `&forecast_days=5`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Weather service returned ${res.status}`);
      const data = await res.json();

      if (!data.current) throw new Error("No current weather data received");

      setWeather(data.current);
      setForecast(data.daily || []);
      setLastUpdated(new Date());
    } catch (err) {
      const msg = err?.message || "Failed to fetch weather";
      setError(msg);
      if (!silent) showToast?.(`Weather unavailable: ${msg}`, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchWeather(location);
    const interval = setInterval(() => fetchWeather(location, true), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [location, fetchWeather]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setSearchResults([]);
    try {
      const url =
        `https://geocoding-api.open-meteo.com/v1/search` +
        `?name=${encodeURIComponent(q)}` +
        `&count=8&language=en&format=json`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        showToast?.(`No locations found for "${q}"`, "error");
        setSearchResults([]);
      } else {
        setSearchResults(data.results);
      }
    } catch (err) {
      showToast?.(`Location search failed: ${err?.message || "unknown error"}`, "error");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = (r) => {
    const name = [r.name, r.admin1, r.country_code].filter(Boolean).join(", ");
    const newLoc = { name, lat: r.latitude, lon: r.longitude };
    setLocation(newLoc);
    saveLocation(newLoc);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    showToast?.(`Weather location set to ${name}`);
  };

  const handleResetDefault = () => {
    setLocation(DEFAULT_LOCATION);
    saveLocation(DEFAULT_LOCATION);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    showToast?.(`Weather location reset to ${DEFAULT_LOCATION.name}`);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 flex items-center justify-center gap-3 text-stone-500 min-h-[200px]">
        <Loader2 className="animate-spin" size={24} />
        Loading weather...
      </div>
    );
  }

  if (error && !weather) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 flex flex-col items-center justify-center gap-3 text-stone-500 min-h-[200px]">
        <Cloud size={36} className="text-stone-300" />
        <p className="text-sm font-medium">Weather unavailable</p>
        <p className="text-xs text-stone-400">{error}</p>
        <button
          type="button"
          onClick={() => fetchWeather(location)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 transition-colors text-sm font-medium text-stone-600"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const code = weather?.weather_code ?? 0;
  const info = getWeatherInfo(code);
  const WeatherIcon = info.icon;

  const sunrise = forecast.sunrise?.[0] ? new Date(forecast.sunrise[0]) : null;
  const sunset = forecast.sunset?.[0] ? new Date(forecast.sunset[0]) : null;
  const daytime = isDaytime(new Date(), sunrise, sunset);
  const iconColor = daytime ? info.day : info.night;

  const temp = weather?.temperature_2m ?? 0;
  const feelsLike = weather?.apparent_temperature ?? 0;
  const humidity = weather?.relative_humidity_2m ?? 0;
  const windSpeed = weather?.wind_speed_10m ?? 0;
  const windDir = weather?.wind_direction_10m ?? 0;
  const precip = weather?.precipitation ?? 0;
  const pressure = weather?.surface_pressure ?? 0;
  const cloudCover = weather?.cloud_cover ?? 0;
  const visibility = weather?.visibility ?? 0;

  const windDirLabel = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const dirIdx = Math.round(windDir / 22.5) % 16;
  const dirText = windDirLabel[dirIdx];

  const formatTime = (date) => {
    if (!date) return "—";
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100 bg-gradient-to-r from-sky-50/50 to-emerald-50/30">
        <div className="flex items-center gap-2">
          <Cloud size={18} className="text-sky-500" />
          <h3 className="font-semibold text-stone-700 text-sm">Local Weather</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className={`p-1.5 rounded-lg transition-colors ${searchOpen ? "text-emerald-600 bg-emerald-50" : "text-stone-400 hover:text-stone-600 hover:bg-stone-100"}`}
            title="Change location"
          >
            <Search size={14} />
          </button>
          <button
            type="button"
            onClick={() => fetchWeather(location)}
            disabled={refreshing}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Location search panel */}
      {searchOpen && (
        <div className="px-5 py-4 border-b border-stone-100 bg-stone-50/50 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter zip code or city (e.g. 55358, Maple Lake, MN)"
                autoFocus
                className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {searching ? <Loader2 size={14} className="animate-spin" /> : "Find"}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {searchResults.map((r, i) => (
                <button
                  key={`${r.id}-${i}`}
                  type="button"
                  onClick={() => handleSelectResult(r)}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white hover:border-stone-200 border border-transparent transition-colors"
                >
                  <MapPin size={13} className="text-stone-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-700 truncate">
                      {r.name}{r.admin1 ? `, ${r.admin1}` : ""}
                    </p>
                    <p className="text-xs text-stone-400 truncate">
                      {r.country}{r.postal_codes ? ` (${r.postal_codes})` : ""} · {r.latitude.toFixed(3)}, {r.longitude.toFixed(3)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 font-medium"
          >
            <Crosshair size={12} /> Reset to {DEFAULT_LOCATION.name}
          </button>
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Current conditions */}
        <div className="flex items-start gap-4">
          <div className={`shrink-0 ${iconColor}`}>
            <WeatherIcon size={56} strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-stone-800">{Math.round(temp)}</span>
              <span className="text-xl text-stone-400">°F</span>
            </div>
            <p className="text-sm font-medium text-stone-600">{info.label}</p>
            <p className="text-xs text-stone-400">Feels like {Math.round(feelsLike)}°F</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-stone-400 flex items-center gap-1 justify-end">
              <MapPin size={11} /> {location.name}
            </p>
            <p className="text-xs text-stone-400 mt-0.5">
              {location.lat.toFixed(3)}, {location.lon.toFixed(3)}
            </p>
            {lastUpdated && (
              <p className="text-xs text-stone-400 mt-1">
                Updated {lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </p>
            )}
          </div>
        </div>

        {/* Metric grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Metric icon={<Droplets size={15} />} label="Humidity" value={`${humidity}%`} color="text-sky-500" />
          <Metric icon={<Wind size={15} />} label="Wind" value={`${Math.round(windSpeed)} mph ${dirText}`} color="text-teal-500" />
          <Metric icon={<CloudRain size={15} />} label="Precip" value={`${precip.toFixed(2)} in`} color="text-blue-500" />
          <Metric icon={<Gauge size={15} />} label="Pressure" value={`${Math.round(pressure)} hPa`} color="text-stone-500" />
          <Metric icon={<Eye size={15} />} label="Visibility" value={`${Math.round(visibility / 1609.34)} mi`} color="text-indigo-500" />
          <Metric icon={<Cloud size={15} />} label="Cloud Cover" value={`${cloudCover}%`} color="text-stone-500" />
        </div>

        {/* Sun times */}
        {sunrise && sunset && (
          <div className="flex items-center justify-between rounded-lg bg-amber-50/50 border border-amber-100 px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <Sunrise size={16} className="text-amber-500" />
              <span className="font-medium">{formatTime(sunrise)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <span className="font-medium">{formatTime(sunset)}</span>
              <Sunset size={16} className="text-orange-500" />
            </div>
          </div>
        )}

        {/* 5-day forecast */}
        {forecast.time && forecast.time.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">5-Day Forecast</p>
            <div className="grid grid-cols-5 gap-1.5">
              {forecast.time.slice(0, 5).map((dateStr, i) => {
                const dayInfo = getWeatherInfo(forecast.weather_code?.[i] ?? 0);
                const DayIcon = dayInfo.icon;
                const maxT = forecast.temperature_2m_max?.[i] ?? 0;
                const minT = forecast.temperature_2m_min?.[i] ?? 0;
                const precipProb = forecast.precipitation_probability_max?.[i] ?? 0;
                const date = new Date(dateStr + "T00:00");
                const dayLabel = i === 0
                  ? "Today"
                  : date.toLocaleDateString("en-US", { weekday: "short" });

                return (
                  <div
                    key={dateStr}
                    className="flex flex-col items-center gap-1 rounded-lg border border-stone-100 p-2 hover:bg-stone-50 transition-colors"
                  >
                    <span className="text-xs font-medium text-stone-600">{dayLabel}</span>
                    <DayIcon size={22} className={`${dayInfo.day} my-0.5`} strokeWidth={1.5} />
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-semibold text-stone-800">{Math.round(maxT)}°</span>
                      <span className="text-xs text-stone-400">{Math.round(minT)}°</span>
                    </div>
                    {precipProb > 0 && (
                      <span className="text-xs text-sky-500 flex items-center gap-0.5">
                        <Droplets size={9} /> {precipProb}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-amber-500 flex items-center gap-1.5">
            <Cloud size={12} /> Showing last known data — refresh failed
          </p>
        )}
      </div>
    </div>
  );
}

function Metric({ icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-stone-50 px-2.5 py-2">
      <span className={color}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-stone-400 leading-tight">{label}</p>
        <p className="text-sm font-medium text-stone-700 leading-tight truncate">{value}</p>
      </div>
    </div>
  );
}
