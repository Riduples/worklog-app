CREATE TABLE mileage_trips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  odometer_start  NUMERIC(10,1) NOT NULL,
  odometer_end    NUMERIC(10,1) NOT NULL,
  km_travelled    NUMERIC(8,2) NOT NULL,
  trip_type       TEXT,
  purpose         TEXT,
  sars_deduction  NUMERIC(10,2),
  trip_date       DATE NOT NULL,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mileage_user_date ON mileage_trips(user_id, trip_date);

ALTER TABLE mileage_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON mileage_trips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON mileage_trips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON mileage_trips FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
