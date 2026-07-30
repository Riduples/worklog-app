-- 0098: v126 time-log parity — overtime and the diary link.
-- ot_hours + ot_multiplier: overtime hours paid at 1.5x (standard) or 2x
--   (Sunday/public holiday). amount_to_bill already folds these in, computed
--   client-side, so this just persists the inputs behind that figure.
-- booking_id: the diary appointment this session was logged against — picking one
--   auto-fills the customer/date/purpose/quote. FK ON DELETE SET NULL so deleting
--   a booking leaves the time entry intact, just unlinked.
-- All additive; defaults reproduce the pre-existing (no-overtime) behaviour.
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS ot_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ot_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;
