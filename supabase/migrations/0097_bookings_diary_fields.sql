-- 0097: merge v126's diary/appointment layer onto the priced-job booking.
-- appt_type: customer (default) or supplier appointment.
-- purpose/location/notes: free text. duration_min: appointment length.
-- linked_quote_id: attach the appointment to a customer quote (bare uuid, no FK —
--   a deleted quote just leaves a dangling id the UI ignores, like other soft refs).
-- is_onsite + distance_km: an on-site visit auto-logs a mileage trip's SARS deduction.
-- recurrence: none/weekly/... generates future bookings up-front on save.
-- reminder: whether to send the client a day-before WhatsApp reminder.
-- All additive; NOT NULL flags default to the pre-existing behaviour.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS appt_type TEXT NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS duration_min INTEGER,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS linked_quote_id UUID,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_onsite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC,
  ADD COLUMN IF NOT EXISTS recurrence TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS reminder BOOLEAN NOT NULL DEFAULT false;
