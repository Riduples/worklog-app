-- 0099: v126 trip-log parity — the diary link on mileage trips.
-- booking_id: the diary appointment this trip was driven for. Picking one in the
--   Trip Log auto-fills the date, purpose and trip type; the on-site booking
--   auto-mileage also stamps it for traceability. FK ON DELETE SET NULL so
--   deleting a booking leaves the trip (and its SARS deduction) intact, unlinked.
ALTER TABLE public.mileage_trips
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;
