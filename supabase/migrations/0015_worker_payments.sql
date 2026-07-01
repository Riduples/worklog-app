CREATE TABLE worker_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_name     TEXT NOT NULL,
  daily_wage      NUMERIC(10,2) NOT NULL,
  days_worked     INTEGER NOT NULL DEFAULT 0,
  total_wages     NUMERIC(12,2) NOT NULL,
  uif_due         NUMERIC(10,2) NOT NULL,
  payment_date    DATE NOT NULL,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_worker_payments_user_date ON worker_payments(user_id, payment_date);

ALTER TABLE worker_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON worker_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON worker_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON worker_payments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
