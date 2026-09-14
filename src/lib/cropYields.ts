// Average yield and market price reference for the 15 supported crop types.
// Values are approximate U.S. averages for planning/estimation only.
// yield_per_acre is in the crop's standard unit; price_per_unit is in USD.
// revenue_per_acre = yield_per_acre * price_per_unit (precomputed for convenience).

export interface CropYieldData {
  crop: string;
  unit: string;
  yield_per_acre: number;
  price_per_unit: number;
  revenue_per_acre: number;
}

export const CROP_YIELD_DATA: Record<string, CropYieldData> = {
  Corn: { crop: "Corn", unit: "bu", yield_per_acre: 180, price_per_unit: 4.7, revenue_per_acre: 846 },
  Soybeans: { crop: "Soybeans", unit: "bu", yield_per_acre: 52, price_per_unit: 12.5, revenue_per_acre: 650 },
  Wheat: { crop: "Wheat", unit: "bu", yield_per_acre: 50, price_per_unit: 6.5, revenue_per_acre: 325 },
  Potatoes: { crop: "Potatoes", unit: "cwt", yield_per_acre: 450, price_per_unit: 9.5, revenue_per_acre: 4275 },
  Cotton: { crop: "Cotton", unit: "bale", yield_per_acre: 2.5, price_per_unit: 500, revenue_per_acre: 1250 },
  "Hay / Alfalfa": { crop: "Hay / Alfalfa", unit: "ton", yield_per_acre: 4, price_per_unit: 180, revenue_per_acre: 720 },
  Sugarcane: { crop: "Sugarcane", unit: "ton", yield_per_acre: 32, price_per_unit: 35, revenue_per_acre: 1120 },
  Peanuts: { crop: "Peanuts", unit: "lb", yield_per_acre: 4200, price_per_unit: 0.25, revenue_per_acre: 1050 },
  Hazelnut: { crop: "Hazelnut", unit: "lb", yield_per_acre: 2000, price_per_unit: 1.2, revenue_per_acre: 2400 },
  Elderberry: { crop: "Elderberry", unit: "lb", yield_per_acre: 4000, price_per_unit: 1.5, revenue_per_acre: 6000 },
  Silphium: { crop: "Silphium", unit: "ton", yield_per_acre: 5, price_per_unit: 80, revenue_per_acre: 400 },
  "Gourmet Garlic": { crop: "Gourmet Garlic", unit: "lb", yield_per_acre: 8000, price_per_unit: 1.0, revenue_per_acre: 8000 },
  Lavender: { crop: "Lavender", unit: "lb", yield_per_acre: 300, price_per_unit: 12, revenue_per_acre: 3600 },
  "Cover Crop": { crop: "Cover Crop", unit: "acre", yield_per_acre: 1, price_per_unit: 50, revenue_per_acre: 50 },
  Other: { crop: "Other", unit: "acre", yield_per_acre: 1, price_per_unit: 0, revenue_per_acre: 0 },
};

export function getCropYieldData(crop: string | null | undefined): CropYieldData | null {
  if (!crop) return null;
  return CROP_YIELD_DATA[crop] || null;
}

export function estimateFieldRevenue(acres: number | null | undefined, crop: string | null | undefined): number {
  if (!acres || !crop) return 0;
  const data = getCropYieldData(crop);
  if (!data) return 0;
  return acres * data.revenue_per_acre;
}

export function estimateFieldYield(acres: number | null | undefined, crop: string | null | undefined): number {
  if (!acres || !crop) return 0;
  const data = getCropYieldData(crop);
  if (!data) return 0;
  return acres * data.yield_per_acre;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}
