CREATE TABLE invoices (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_number              TEXT NOT NULL,
  client_contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,
  client_name             TEXT NOT NULL,
  line_items              JSONB NOT NULL DEFAULT '[]',
  invoice_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_received        NUMERIC(12,2) DEFAULT 0,
  balance_due             NUMERIC(12,2) NOT NULL DEFAULT 0,
  issue_date              DATE NOT NULL,
  due_date                DATE,
  status                  TEXT NOT NULL DEFAULT 'unpaid'
                          CHECK (status IN ('unpaid', 'paid', 'overdue', 'partial')),
  converted_from_quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  paid_date               DATE,
  deleted_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, doc_number)
);

CREATE INDEX idx_invoices_user_status ON invoices(user_id, status);
CREATE INDEX idx_invoices_due_date ON invoices(user_id, due_date);

ALTER TABLE quotes ADD CONSTRAINT fk_quotes_converted_invoice
  FOREIGN KEY (converted_to_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON invoices FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
