CREATE TABLE quotes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_number            TEXT NOT NULL,
  client_contact_id     UUID REFERENCES contacts(id) ON DELETE SET NULL,
  client_name           TEXT NOT NULL,
  line_items            JSONB NOT NULL DEFAULT '[]',
  total_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_requested     NUMERIC(12,2) DEFAULT 0,
  issue_date            DATE NOT NULL,
  valid_until           DATE,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'converted', 'declined')),
  converted_to_invoice_id UUID, -- FK added in 0007 once invoices exists (circular dependency)
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, doc_number)
);

CREATE INDEX idx_quotes_user_status ON quotes(user_id, status);
CREATE INDEX idx_quotes_client ON quotes(user_id, client_contact_id);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON quotes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON quotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON quotes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
