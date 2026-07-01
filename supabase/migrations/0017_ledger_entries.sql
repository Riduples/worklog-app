CREATE TABLE ledger_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ledger_type     TEXT NOT NULL CHECK (ledger_type IN ('client', 'supplier')),
  party_name      TEXT NOT NULL,
  party_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  amount          NUMERIC(12,2) NOT NULL,
  note            TEXT,
  entry_date      DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'unpaid'
                  CHECK (status IN ('unpaid', 'paid', 'partial')),
  paid_date       DATE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ledger_user_type ON ledger_entries(user_id, ledger_type);
CREATE INDEX idx_ledger_user_status ON ledger_entries(user_id, status);

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON ledger_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON ledger_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON ledger_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
