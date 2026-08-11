-- 0114: drop the dead money columns on time_entries.
--
-- The 2026-08-10 "hours-only" Time Log rework stopped writing and reading the
-- per-entry money fields: hourly_rate and amount_to_bill are now neither read
-- nor written anywhere in the app (confirmed by a repo-wide search — every
-- surviving hourly_rate reference is staff_register.hourly_rate, a different,
-- live column). Drop them.
--
-- The overtime columns ot_hours and ot_multiplier are DELIBERATELY KEPT: ot_hours
-- is still read (the loggedHours total + the "(incl. Xh OT)" badge), and overtime
-- may return, so both stay.
--
-- Table-scoped on purpose: staff_register also has an hourly_rate column that is
-- live — only the time_entries copies are dead.

ALTER TABLE public.time_entries
  DROP COLUMN IF EXISTS hourly_rate,
  DROP COLUMN IF EXISTS amount_to_bill;
