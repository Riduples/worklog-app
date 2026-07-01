CREATE TABLE purchase_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_number            TEXT NOT NULL,
  supplier_contact_id   UUID REFERENCES contacts(id) ON DELETE SET NULL,
  supplier_name         TEXT NOT NULL,
  line_items            JSONB NOT NULL DEFAULT '[]',
  total_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  issue_date            DATE NOT NULL,
  requested_delivery    DATE,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'acknowledged', 'fulfilled', 'cancelled')),
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, doc_number)
);

CREATE INDEX idx_po_user_status ON purchase_orders(user_id, status);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON purchase_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON purchase_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON purchase_orders FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
