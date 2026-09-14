/*
# Add crop_type column to fields table

1. Modified Tables
- `fields`
  - Add `crop_type` (text, nullable) — optional label for the crop grown on the field (e.g. "Corn", "Soybeans"). Nullable so existing rows and inserts without a crop type still succeed.
2. Security
- RLS is already enabled with anon+authenticated CRUD policies. No policy changes needed.
*/

ALTER TABLE public.fields
  ADD COLUMN IF NOT EXISTS crop_type text;

-- Re-assert anon-friendly policies (idempotent) to keep the no-auth frontend working
DROP POLICY IF EXISTS "anon_select_fields" ON public.fields;
CREATE POLICY "anon_select_fields" ON public.fields FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fields" ON public.fields;
CREATE POLICY "anon_insert_fields" ON public.fields FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fields" ON public.fields;
CREATE POLICY "anon_update_fields" ON public.fields FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fields" ON public.fields;
CREATE POLICY "anon_delete_fields" ON public.fields FOR DELETE
  TO anon, authenticated USING (true);
