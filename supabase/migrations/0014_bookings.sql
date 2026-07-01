CREATE TABLE bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name     TEXT NOT NULL,
  client_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  service         TEXT,
  booking_date    DATE NOT NULL,
  booking_time    TIME,
  total_price     NUMERIC(12,2) DEFAULT 0,
  deposit_paid    NUMERIC(12,2) DEFAULT 0,
  balance_due     NUMERIC(12,2) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('confirmed', 'pending', 'complete', 'cancelled', 'no_show')),
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bookings_user_date ON bookings(user_id, booking_date);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON bookings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
