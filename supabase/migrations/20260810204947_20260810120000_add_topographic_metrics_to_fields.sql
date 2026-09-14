/*
# Add topographic metrics to fields

1. Changes
- Add `min_elevation` to `fields`, storing the lowest sampled elevation in meters.
- Add `max_elevation` to `fields`, storing the highest sampled elevation in meters.
- Add `elevation_change` to `fields`, storing the difference between the highest and lowest sampled elevations in meters.
- Add `dominant_aspect` to `fields`, storing the calculated dominant downslope direction as a compass label.

2. Security
- No new tables or access paths are introduced.
- Existing `fields` row-level security and policies remain unchanged.

3. Important notes
- Existing field rows remain valid and receive NULL until topographic data is calculated or refreshed.
- Elevations are persisted in meters, matching the Open-Elevation API response units.
*/

ALTER TABLE public.fields
  ADD COLUMN IF NOT EXISTS min_elevation double precision,
  ADD COLUMN IF NOT EXISTS max_elevation double precision,
  ADD COLUMN IF NOT EXISTS elevation_change double precision,
  ADD COLUMN IF NOT EXISTS dominant_aspect text;