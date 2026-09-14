/*
# Add acreage tracking to saved fields

1. Modified Tables
- `fields.acres` (numeric): stores the calculated field area in acres for each saved boundary.

2. Data and Behavior
- The dashboard calculates acreage from each drawn GeoJSON polygon before saving.
- Existing fields receive a nullable value until they are edited or recreated; no existing rows or data are removed.

3. Security
- No new tables or access rules are introduced.
- Existing `fields` row-level security policies remain unchanged.

4. Important Notes
- Acreage is stored as a numeric value so the application can display and use it for planning.
- The column is added only if it does not already exist, making this migration safe to re-run.
*/

ALTER TABLE public.fields
ADD COLUMN IF NOT EXISTS acres numeric;