CREATE TABLE tax_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_type     TEXT NOT NULL
                  CHECK (record_type IN ('provisional_payment', 'tax_jar_snapshot', 'vat_return')),
  tax_year        INTEGER,
  period          TEXT,
  amount          NUMERIC(12,2) NOT NULL,
  notes           TEXT,
  entry_date      DATE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tax_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON tax_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON tax_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON tax_records FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
