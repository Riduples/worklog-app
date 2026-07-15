-- Daily cash-up (v2 Phase 10): till reconciliation. cash_in/cash_out/expected
-- are snapshots of what was logged on that date at the moment of counting —
-- stored rather than recomputed so a later back-dated entry doesn't silently
-- rewrite history and make a past variance look wrong.
CREATE TABLE cash_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  cash_up_date date NOT NULL,
  cash_in numeric(12,2) NOT NULL DEFAULT 0,
  cash_out numeric(12,2) NOT NULL DEFAULT 0,
  expected numeric(12,2) NOT NULL DEFAULT 0,
  counted numeric(12,2) NOT NULL DEFAULT 0,
  variance numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_cash_ups_business_id ON cash_ups(business_id);

ALTER TABLE cash_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_member" ON cash_ups FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "insert_member" ON cash_ups FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "update_member" ON cash_ups FOR UPDATE USING (is_business_member(business_id)) WITH CHECK (is_business_member(business_id));

-- Bank statement import writes income/expense rows tagged with their origin,
-- the same way Quick Log tags 'quick_log' and Pay Run tags 'payroll'.
ALTER TABLE income DROP CONSTRAINT income_source_check;
ALTER TABLE income ADD CONSTRAINT income_source_check
  CHECK (source = ANY (ARRAY['manual'::text, 'quick_log'::text, 'bank_statement'::text]));

ALTER TABLE expenses DROP CONSTRAINT expenses_source_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_source_check
  CHECK (source = ANY (ARRAY['manual'::text, 'quick_log'::text, 'payroll'::text, 'bank_statement'::text]));
