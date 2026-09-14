export const CROP_COLORS: Record<string, { color: string; fillColor: string; fillOpacity: number }> = {
  Corn: { color: "#a16207", fillColor: "#fde047", fillOpacity: 0.25 },
  Soybeans: { color: "#ca8a04", fillColor: "#facc15", fillOpacity: 0.25 },
  Wheat: { color: "#92400e", fillColor: "#d97706", fillOpacity: 0.25 },
  Potatoes: { color: "#b45309", fillColor: "#f97316", fillOpacity: 0.25 },
  Cotton: { color: "#475569", fillColor: "#e2e8f0", fillOpacity: 0.25 },
  "Hay / Alfalfa": { color: "#65a30d", fillColor: "#84cc16", fillOpacity: 0.25 },
  Sugarcane: { color: "#15803d", fillColor: "#22c55e", fillOpacity: 0.25 },
  Peanuts: { color: "#9a3412", fillColor: "#fb923c", fillOpacity: 0.25 },
  Hazelnut: { color: "#166534", fillColor: "#16a34a", fillOpacity: 0.25 },
  Elderberry: { color: "#7c3aed", fillColor: "#a855f7", fillOpacity: 0.25 },
  Silphium: { color: "#3f6212", fillColor: "#bef264", fillOpacity: 0.25 },
  "Gourmet Garlic": { color: "#be123c", fillColor: "#fb7185", fillOpacity: 0.25 },
  Lavender: { color: "#6d28d9", fillColor: "#c4b5fd", fillOpacity: 0.25 },
  "Cover Crop": { color: "#0ea5e9", fillColor: "#38bdf8", fillOpacity: 0.25 },
  Other: { color: "#64748b", fillColor: "#94a3b8", fillOpacity: 0.25 },
};

export const DEFAULT_CROP_STYLE = {
  color: "#10b981",
  fillColor: "#10b981",
  fillOpacity: 0.15,
};

export const CROP_OPTIONS = [
  "Corn",
  "Soybeans",
  "Wheat",
  "Potatoes",
  "Cotton",
  "Hay / Alfalfa",
  "Sugarcane",
  "Peanuts",
  "Hazelnut",
  "Elderberry",
  "Silphium",
  "Gourmet Garlic",
  "Lavender",
  "Cover Crop",
  "Other",
];

export function styleForCrop(crop: string | null | undefined) {
  return (crop && CROP_COLORS[crop]) || DEFAULT_CROP_STYLE;
}
