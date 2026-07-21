-- 0067: bank accounts — view transactions per account, keep combined totals.
--
-- A bank_account is a named cash account the owner creates (e.g. "FNB Cheque"),
-- with an opening balance + date so a running balance can be shown. It's a label
-- and a starting point, not a live bank link. income/expenses gain an optional
-- account_id; untagged rows — and every row that predates this feature — simply
-- live under the combined "All accounts" view, which stays the default.

CREATE TABLE bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  bank_name text,
  account_type text NOT NULL DEFAULT 'bank'
    CHECK (account_type = ANY (ARRAY['bank'::text, 'savings'::text, 'credit'::text, 'cash'::text, 'other'::text])),
  -- The running balance is opening_balance + money in − money out (gross, cash
  -- basis) for rows dated on/after opening_balance_date. A null date means "from
  -- the very beginning" (count everything tagged to the account).
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  opening_balance_date date,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_bank_accounts_business_id ON bank_accounts(business_id);
-- At most one default account per business (ignoring closed ones).
CREATE UNIQUE INDEX uniq_default_bank_account_per_business
  ON bank_accounts(business_id) WHERE is_default AND deleted_at IS NULL;

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- Shared setup data: any member can see the accounts (they need them to read and
-- tag transactions). Creating/editing follows the read-only trial gate the same
-- way invites and generated_documents do (they sit outside the per-tool matrix).
CREATE POLICY "select_member" ON bank_accounts FOR SELECT
  USING (is_business_member(business_id));
CREATE POLICY "insert_member" ON bank_accounts FOR INSERT
  WITH CHECK (is_business_member(business_id) AND business_is_writable(business_id));
CREATE POLICY "update_member" ON bank_accounts FOR UPDATE
  USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id) AND business_is_writable(business_id));

-- The tag. Nullable: null = unassigned / combined-only. ON DELETE SET NULL is a
-- backstop for a hard delete; accounts are normally soft-deleted (deleted_at) so
-- a closed account keeps its history.
ALTER TABLE income   ADD COLUMN account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL;
CREATE INDEX idx_income_account_id   ON income(account_id)   WHERE account_id IS NOT NULL;
CREATE INDEX idx_expenses_account_id ON expenses(account_id) WHERE account_id IS NOT NULL;
