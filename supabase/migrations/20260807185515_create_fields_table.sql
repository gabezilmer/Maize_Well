/*
# Create fields table for farm boundary polygons

1. New Tables
- `fields`
  - `id` (uuid, primary key)
  - `name` (text, not null) — the user-supplied field name
  - `geojson` (jsonb, not null) — the GeoJSON polygon from Leaflet-draw
  - `created_at` (timestamptz, defaults to now)
2. Security
- Enable RLS on `fields`.
- Allow anon + authenticated CRUD because the app has no sign-in screen and the data is intentionally shared/public.
*/

CREATE TABLE IF NOT EXISTS fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  geojson jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_fields" ON fields;
CREATE POLICY "anon_select_fields" ON fields FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fields" ON fields;
CREATE POLICY "anon_insert_fields" ON fields FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fields" ON fields;
CREATE POLICY "anon_update_fields" ON fields FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fields" ON fields;
CREATE POLICY "anon_delete_fields" ON fields FOR DELETE
  TO anon, authenticated USING (true);
