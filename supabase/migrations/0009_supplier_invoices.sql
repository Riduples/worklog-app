CREATE TABLE supplier_invoices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_contact_id   UUID REFERENCES contacts(id) ON DELETE SET NULL,
  supplier_name         TEXT NOT NULL,
  supplier_ref_number   TEXT,
  line_items            JSONB NOT NULL DEFAULT '[]',
  invoice_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount           NUMERIC(12,2) DEFAULT 0,
  balance_due           NUMERIC(12,2) NOT NULL DEFAULT 0,
  issue_date            DATE NOT NULL,
  due_date              DATE,
  status                TEXT NOT NULL DEFAULT 'unpaid'
                        CHECK (status IN ('unpaid', 'paid', 'overdue')),
  linked_po_id          UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  paid_date             DATE,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_supplier_invoices_user_status ON supplier_invoices(user_id, status);

ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON supplier_invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON supplier_invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON supplier_invoices FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
