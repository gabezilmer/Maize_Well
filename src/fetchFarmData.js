import { supabase } from "./lib/supabase";

/**
 * Fetches all farms for the logged-in user and attaches their
 * field data (including GeoJSON boundary coordinates).
 */
export async function fetchFarmsWithFields() {
  // 1. Get all farms for this user
  const { data: farms, error: farmsError } = await supabase
    .from("farms")
    .select("id, name, location, created_at")
    .order("created_at", { ascending: false });
  if (farmsError) throw farmsError;
  if (!farms || farms.length === 0) return [];

  // 2. Get fields using the RPC function we created in Supabase
  const { data: fields, error: fieldsError } = await supabase.rpc(
    "get_fields_with_geojson"
  );
  if (fieldsError) throw fieldsError;

  // 3. Group the fields by their parent farm_id
  const fieldsByFarmId = {};
  (fields || []).forEach((field) => {
    if (!fieldsByFarmId[field.farm_id]) {
      fieldsByFarmId[field.farm_id] = [];
    }
    fieldsByFarmId[field.farm_id].push(field);
  });

  // 4. Combine farms with their fields
  return farms.map((farm) => ({
    ...farm,
    fields: fieldsByFarmId[farm.id] || [],
  }));
}

/**
 * Fetches the historical log (planting, amendments, pests) for a specific field.
 */
export async function fetchFieldHistory(fieldId) {
  const { data, error } = await supabase
    .from("field_history")
    .select("*")
    .eq("field_id", fieldId)
    .order("event_date", { ascending: false });
  if (error) throw error;
  return data || [];
}
