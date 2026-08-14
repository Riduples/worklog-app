-- 0116: Vehicle record + annual odometer — completes the SARS travel logbook.
--
-- The Travel Log already captures each trip's opening/closing odometer, distance
-- and the per-km SARS deduction. A SARS logbook for the simplified (prescribed
-- per-km) method also needs the vehicle it was driven in and, per tax year, the
-- opening odometer (1 March) and closing odometer (end February) — from which the
-- total km for the year and the business/private split are read.
--
-- This adds those two missing pieces and nothing else: a one-time vehicle record
-- on the business profile, and a small per-tax-year odometer table. It does NOT
-- model travel-allowance cost tables or vehicle running costs — the app claims the
-- per-km method only.

-- One-time vehicle record. Additive and nullable; existing rows stay valid and no
-- RLS change is needed (business_profiles visibility is unchanged).
ALTER TABLE business_profiles
  ADD COLUMN vehicle_description  text,   -- make / model, e.g. "Toyota Hilux 2.4"
  ADD COLUMN vehicle_registration text;   -- number plate, e.g. "CA 123-456"

-- Annual odometer readings, one row per SA tax year (1 Mar – 28/29 Feb). Total km
-- for the year is closing - opening, so it is derived, never stored stale. Kept
-- per year so past logbooks survive (SARS asks you to retain five years).
CREATE TABLE mileage_logbook_years (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id),
  tax_year_start    date NOT NULL,          -- always 1 March of the opening year
  opening_odometer  numeric(10,1),          -- reading at 1 March
  closing_odometer  numeric(10,1),          -- reading at end February
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),

  -- One logbook row per business per tax year (drives the upsert on save).
  CONSTRAINT mileage_logbook_years_unique UNIQUE (business_id, tax_year_start),
  -- Closing can't be before opening when both are set.
  CONSTRAINT mileage_logbook_years_closing_after_opening
    CHECK (closing_odometer IS NULL OR opening_odometer IS NULL OR closing_odometer >= opening_odometer)
);

CREATE INDEX idx_mileage_logbook_years_business ON mileage_logbook_years(business_id);

ALTER TABLE mileage_logbook_years ENABLE ROW LEVEL SECURITY;

-- Same access shape as the trips they summarise (mileage_trips post-0047): gated
-- on the per-tool 'mileage' permission, not just tenancy. has_tool_access already
-- folds in writability at 'edit'+, so no separate business_is_writable is needed.
-- Using is_business_member here would let a member without 'mileage' access read
-- or overwrite the logbook odometer that mileage_trips denies them — an
-- intra-tenant per-tool bypass. There is no deleted_at column, so no 'full' branch.
CREATE POLICY "select_member" ON mileage_logbook_years FOR SELECT
  USING (has_tool_access(business_id, 'mileage', 'view'));
CREATE POLICY "insert_member" ON mileage_logbook_years FOR INSERT
  WITH CHECK (has_tool_access(business_id, 'mileage', 'edit'));
CREATE POLICY "update_member" ON mileage_logbook_years FOR UPDATE
  USING (has_tool_access(business_id, 'mileage', 'edit'))
  WITH CHECK (has_tool_access(business_id, 'mileage', 'edit'));
