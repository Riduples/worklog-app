CREATE TABLE time_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name           TEXT,
  client_contact_id     UUID REFERENCES contacts(id) ON DELETE SET NULL,
  hours_worked          NUMERIC(6,2) NOT NULL,
  hourly_rate           NUMERIC(10,2) DEFAULT 0,
  amount_to_bill        NUMERIC(12,2) DEFAULT 0,
  bill_type             TEXT NOT NULL DEFAULT 'Billable'
                        CHECK (bill_type IN ('Billable', 'Non-billable', 'Admin', 'Travel')),
  description           TEXT,
  entry_date            DATE NOT NULL,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_time_user_date ON time_entries(user_id, entry_date);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON time_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON time_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON time_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
