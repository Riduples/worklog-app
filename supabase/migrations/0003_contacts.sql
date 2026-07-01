CREATE TABLE contacts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_type      TEXT NOT NULL CHECK (contact_type IN ('client', 'supplier')),
  name              TEXT NOT NULL,
  phone             TEXT,
  email             TEXT,
  payment_behaviour TEXT CHECK (payment_behaviour IN ('Good payer', 'Slow payer', 'Problem payer')),
  payment_terms     TEXT CHECK (payment_terms IN ('On delivery', '7 days', '30 days', '60 days', 'Cash only', 'Pre-payment')),
  notes             TEXT,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_contacts_user_type ON contacts(user_id, contact_type);
CREATE INDEX idx_contacts_name ON contacts(user_id, name);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON contacts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
