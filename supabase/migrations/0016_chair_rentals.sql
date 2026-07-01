CREATE TABLE chair_rentals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stylist_name    TEXT NOT NULL,
  weekly_rental   NUMERIC(10,2) DEFAULT 0,
  product_sales   NUMERIC(10,2) DEFAULT 0,
  commission_pct  NUMERIC(5,2) DEFAULT 10,
  commission_amt  NUMERIC(10,2) DEFAULT 0,
  total_due       NUMERIC(10,2) DEFAULT 0,
  period_date     DATE NOT NULL,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chair_rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON chair_rentals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON chair_rentals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON chair_rentals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
