/*
# Create soil_metrics table for soil health tracking

1. New Tables
- `soil_metrics`
  - `id` (uuid, primary key)
  - `field_id` (uuid, foreign key to fields.id, cascade on delete)
  - `ph` (numeric, nullable): soil pH value (0-14 scale)
  - `organic_matter_pct` (numeric, nullable): organic matter percentage
  - `soil_moisture_pct` (numeric, nullable): soil moisture percentage
  - `notes` (text, nullable): optional free-form notes
  - `tested_at` (timestamptz): timestamp of the soil test
  - `created_at` (timestamptz, default now())

2. Security
- RLS enabled on `soil_metrics`.
- Single-tenant app (no auth): CRUD open to anon + authenticated, matching the fields table policy pattern.

3. Important Notes
- Each soil test row is linked to a field via `field_id` with ON DELETE CASCADE so metrics are removed when a field is deleted.
- All metric columns are nullable so partial tests (e.g. pH only) are supported.
- An index on `field_id` speeds up per-field history queries.
*/

CREATE TABLE IF NOT EXISTS public.soil_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
  ph numeric,
  organic_matter_pct numeric,
  soil_moisture_pct numeric,
  notes text,
  tested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.soil_metrics ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_soil_metrics_field_id ON public.soil_metrics(field_id);

DROP POLICY IF EXISTS "anon_select_soil_metrics" ON public.soil_metrics;
CREATE POLICY "anon_select_soil_metrics" ON public.soil_metrics FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_soil_metrics" ON public.soil_metrics;
CREATE POLICY "anon_insert_soil_metrics" ON public.soil_metrics FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_soil_metrics" ON public.soil_metrics;
CREATE POLICY "anon_update_soil_metrics" ON public.soil_metrics FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_soil_metrics" ON public.soil_metrics;
CREATE POLICY "anon_delete_soil_metrics" ON public.soil_metrics FOR DELETE
  TO anon, authenticated USING (true);