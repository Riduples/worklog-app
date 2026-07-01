CREATE TABLE expenses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount                NUMERIC(12,2) NOT NULL,
  what_for              TEXT,
  sars_category         TEXT,
  details               TEXT,
  paid_to               TEXT,
  paid_to_contact_id    UUID REFERENCES contacts(id) ON DELETE SET NULL,
  payment_method        TEXT,
  transaction_date      DATE NOT NULL,
  matched_document_id   UUID,
  matched_document_type TEXT CHECK (matched_document_type IN ('quote', 'purchaseorder')),
  source                TEXT DEFAULT 'manual'
                        CHECK (source IN ('manual', 'quick_log')),
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expenses_user_date ON expenses(user_id, transaction_date);
CREATE INDEX idx_expenses_user_category ON expenses(user_id, sars_category);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON expenses FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
