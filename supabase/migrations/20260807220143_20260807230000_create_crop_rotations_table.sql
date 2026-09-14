/*
# Create crop_rotations table for multi-year crop history & planning

1. New Table
- `crop_rotations`
  - `id` (uuid, primary key)
  - `field_id` (uuid, foreign key to fields.id, cascade on delete)
  - `year` (int): the season year (e.g. 2025)
  - `season` (text): 'Spring' | 'Summer' | 'Fall' | 'Winter' | 'Full Year'
  - `crop_type` (text): the crop grown or planned
  - `status` (text): 'planned' | 'planted' | 'harvested'
  - `notes` (text, nullable)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, auto-updated)

2. Security
- RLS enabled. Single-tenant (no auth): CRUD open to anon + authenticated.

3. Notes
- Unique constraint on (field_id, year, season) to prevent duplicate entries for the same field/season.
- Index on field_id for per-field timeline queries.
- updated_at auto-maintained via trigger.
*/

CREATE TABLE IF NOT EXISTS public.crop_rotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
  year int NOT NULL,
  season text NOT NULL DEFAULT 'Full Year',
  crop_type text NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crop_rotations_season_check CHECK (season IN ('Spring', 'Summer', 'Fall', 'Winter', 'Full Year')),
  CONSTRAINT crop_rotations_status_check CHECK (status IN ('planned', 'planted', 'harvested')),
  CONSTRAINT crop_rotations_year_check CHECK (year >= 1900 AND year <= 2100)
);

-- Unique: one crop entry per field per year per season
CREATE UNIQUE INDEX IF NOT EXISTS idx_crop_rotations_field_year_season
  ON public.crop_rotations(field_id, year, season);

-- Index for per-field queries
CREATE INDEX IF NOT EXISTS idx_crop_rotations_field_id ON public.crop_rotations(field_id);

-- Index for ordering by year
CREATE INDEX IF NOT EXISTS idx_crop_rotations_year ON public.crop_rotations(year DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crop_rotations_updated_at ON public.crop_rotations;
CREATE TRIGGER trg_crop_rotations_updated_at
  BEFORE UPDATE ON public.crop_rotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crop_rotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_crop_rotations" ON public.crop_rotations;
CREATE POLICY "anon_select_crop_rotations" ON public.crop_rotations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_crop_rotations" ON public.crop_rotations;
CREATE POLICY "anon_insert_crop_rotations" ON public.crop_rotations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_crop_rotations" ON public.crop_rotations;
CREATE POLICY "anon_update_crop_rotations" ON public.crop_rotations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_crop_rotations" ON public.crop_rotations;
CREATE POLICY "anon_delete_crop_rotations" ON public.crop_rotations FOR DELETE
  TO anon, authenticated USING (true);