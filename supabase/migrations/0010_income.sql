CREATE TABLE income (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount                NUMERIC(12,2) NOT NULL,
  what_for              TEXT,
  sars_category         TEXT,
  details               TEXT,
  received_from         TEXT,
  received_from_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  payment_method        TEXT,
  transaction_date      DATE NOT NULL,
  tax_jar_amount        NUMERIC(12,2),
  matched_invoice_id    UUID REFERENCES invoices(id) ON DELETE SET NULL,
  source                TEXT DEFAULT 'manual'
                        CHECK (source IN ('manual', 'quick_log')),
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_income_user_date ON income(user_id, transaction_date);
CREATE INDEX idx_income_user_category ON income(user_id, sars_category);

ALTER TABLE income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON income FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON income FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON income FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
