/*
# Add soil_type column to fields table

1. Modified Tables
- `fields`
  - New column `soil_type` (text, nullable) — stores the USDA SSURGO map unit name
    or SoilGrids-derived soil texture description for the field's location.
  - New column `soil_source` (text, nullable) — records which data source provided
    the soil type ("USDA SSURGO" or "SoilGrids").
2. Security
- No changes to existing RLS policies. The new columns inherit the table's existing
  anon/authenticated CRUD policies.
3. Important Notes
- Both columns are nullable so existing rows are unaffected.
- Soil data is populated automatically when a new field is drawn and saved.
*/

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS soil_type text,
  ADD COLUMN IF NOT EXISTS soil_source text;
