/*
# Add nullable farm_id to fields table and ensure anon access

1. Modified Tables
- `fields`
  - Add `farm_id` (uuid, nullable) — links a field to a farm; nullable so inserts without a farm still succeed.
2. Security
- RLS is already enabled with anon+authenticated CRUD policies.
- This migration re-asserts those policies idempotently to guarantee anon inserts/selects work for testing.
*/

ALTER TABLE public.fields
  ADD COLUMN IF NOT EXISTS farm_id uuid;

-- Re-assert anon-friendly policies (idempotent)
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
