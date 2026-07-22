-- 0069: transfers between the business's own accounts. A transfer moves money
-- from one account to another (e.g. FNB → Capitec) — it is NOT income or expense
-- and does not touch profit; it only shifts each account's running balance.
CREATE TABLE account_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  from_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  to_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  transfer_date date NOT NULL,
  note text,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT from_and_to_differ CHECK (from_account_id <> to_account_id)
);
CREATE INDEX idx_account_transfers_business_id ON account_transfers(business_id);
CREATE INDEX idx_account_transfers_from ON account_transfers(from_account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_account_transfers_to ON account_transfers(to_account_id) WHERE deleted_at IS NULL;

ALTER TABLE account_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_member" ON account_transfers FOR SELECT
  USING (is_business_member(business_id));
CREATE POLICY "insert_member" ON account_transfers FOR INSERT
  WITH CHECK (is_business_member(business_id) AND business_is_writable(business_id));
CREATE POLICY "update_member" ON account_transfers FOR UPDATE
  USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id) AND business_is_writable(business_id));
