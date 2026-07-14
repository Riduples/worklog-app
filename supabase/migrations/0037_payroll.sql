-- Payroll (v2 Phase 10): staff register, pay runs, advances (worker_loans),
-- and BCEA leave tracking. Business-scoped like every other v2 table —
-- RLS via is_business_member(business_id), no per-row user_id ownership check.

CREATE TABLE staff_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  full_name text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  employment_type text NOT NULL DEFAULT 'permanent' CHECK (employment_type IN ('permanent', 'fixed_term', 'casual', 'contractor')),
  is_contractor boolean NOT NULL DEFAULT false,
  trading_name text,
  id_number text,
  tax_number text,
  contact_number text,
  start_date date,
  contract_end_date date,
  pay_type text NOT NULL DEFAULT 'Daily' CHECK (pay_type IN ('Daily', 'Hourly', 'Monthly')),
  daily_wage numeric(12,2) DEFAULT 0,
  hourly_rate numeric(12,2) DEFAULT 0,
  monthly_salary numeric(12,2) DEFAULT 0,
  days_per_week numeric(4,2) DEFAULT 5,
  hours_per_day numeric(4,2) DEFAULT 8,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE pay_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  staff_id uuid REFERENCES staff_register(id) ON DELETE SET NULL,
  worker_name text NOT NULL,
  pay_period text NOT NULL CHECK (pay_period IN ('Weekly', 'Fortnightly', 'Monthly')),
  pay_date date NOT NULL,
  units_worked numeric(10,2) DEFAULT 0,
  base_rate numeric(12,2) DEFAULT 0,
  overtime_amount numeric(12,2) DEFAULT 0,
  allowances_amount numeric(12,2) DEFAULT 0,
  gross_wages numeric(12,2) NOT NULL DEFAULT 0,
  uif_employee numeric(12,2) DEFAULT 0,
  uif_employer numeric(12,2) DEFAULT 0,
  uif_total numeric(12,2) DEFAULT 0,
  paye numeric(12,2) DEFAULT 0,
  sdl numeric(12,2) DEFAULT 0,
  loan_deducted numeric(12,2) DEFAULT 0,
  other_deductions numeric(12,2) DEFAULT 0,
  other_deduction_desc text,
  leave_days numeric(6,2) DEFAULT 0,
  leave_type text,
  net_pay numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'approved')),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE worker_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  staff_id uuid REFERENCES staff_register(id) ON DELETE SET NULL,
  worker_name text NOT NULL,
  loan_type text NOT NULL CHECK (loan_type IN ('advance', 'repayment')),
  amount numeric(12,2) NOT NULL,
  note text,
  entry_date date NOT NULL DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE worker_leave (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  staff_id uuid REFERENCES staff_register(id) ON DELETE SET NULL,
  worker_name text NOT NULL,
  leave_type text NOT NULL CHECK (leave_type IN ('Annual', 'Sick', 'Family', 'Unpaid', 'Public Holiday', 'Maternity', 'Parental')),
  days numeric(6,2) NOT NULL,
  start_date date NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_staff_register_business_id ON staff_register(business_id);
CREATE INDEX idx_pay_runs_business_id ON pay_runs(business_id);
CREATE INDEX idx_pay_runs_staff_id ON pay_runs(staff_id);
CREATE INDEX idx_worker_loans_business_id ON worker_loans(business_id);
CREATE INDEX idx_worker_loans_staff_id ON worker_loans(staff_id);
CREATE INDEX idx_worker_leave_business_id ON worker_leave(business_id);
CREATE INDEX idx_worker_leave_staff_id ON worker_leave(staff_id);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['staff_register', 'pay_runs', 'worker_loans', 'worker_leave']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "select_member" ON %I FOR SELECT USING (is_business_member(business_id))', t);
    EXECUTE format('CREATE POLICY "insert_member" ON %I FOR INSERT WITH CHECK (is_business_member(business_id))', t);
    EXECUTE format('CREATE POLICY "update_member" ON %I FOR UPDATE USING (is_business_member(business_id)) WITH CHECK (is_business_member(business_id))', t);
  END LOOP;
END $$;

-- ── create_pay_run ───────────────────────────────────────────────────────────
-- Atomically writes the pay run plus its downstream records (matching the
-- source prototype's saveAll(): a wages expense, a UIF expense if >0, an SDL
-- expense if >0, a loan repayment if any was deducted, and a leave record if
-- leave was taken this run). SECURITY INVOKER — relies on the caller's own
-- RLS just like convert_quote_to_invoice, no elevated privilege needed since
-- every insert is scoped to the same business_id the caller is a member of.
CREATE FUNCTION create_pay_run(
  p_business_id uuid,
  p_staff_id uuid,
  p_worker_name text,
  p_pay_period text,
  p_pay_date date,
  p_units_worked numeric,
  p_base_rate numeric,
  p_overtime_amount numeric,
  p_allowances_amount numeric,
  p_gross_wages numeric,
  p_uif_employee numeric,
  p_uif_employer numeric,
  p_paye numeric,
  p_sdl numeric,
  p_loan_deducted numeric,
  p_other_deductions numeric,
  p_other_deduction_desc text,
  p_leave_days numeric,
  p_leave_type text,
  p_net_pay numeric,
  p_status text
)
RETURNS pay_runs
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_pay_run pay_runs%ROWTYPE;
BEGIN
  IF p_status NOT IN ('prepared', 'approved') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  INSERT INTO pay_runs (
    business_id, user_id, staff_id, worker_name, pay_period, pay_date,
    units_worked, base_rate, overtime_amount, allowances_amount, gross_wages,
    uif_employee, uif_employer, uif_total, paye, sdl, loan_deducted,
    other_deductions, other_deduction_desc, leave_days, leave_type, net_pay,
    status, approved_by, approved_at
  ) VALUES (
    p_business_id, v_user_id, p_staff_id, p_worker_name, p_pay_period, p_pay_date,
    p_units_worked, p_base_rate, p_overtime_amount, p_allowances_amount, p_gross_wages,
    p_uif_employee, p_uif_employer, p_uif_employee + p_uif_employer, p_paye, p_sdl, p_loan_deducted,
    p_other_deductions, p_other_deduction_desc, p_leave_days, p_leave_type, p_net_pay,
    p_status,
    CASE WHEN p_status = 'approved' THEN v_user_id ELSE NULL END,
    CASE WHEN p_status = 'approved' THEN now() ELSE NULL END
  )
  RETURNING * INTO v_pay_run;

  INSERT INTO expenses (business_id, user_id, amount, sars_category, what_for, paid_to, payment_method, transaction_date, source)
  VALUES (p_business_id, v_user_id, p_gross_wages, 'Employee costs — Salaries & wages', 'Wages — ' || p_worker_name, p_worker_name, 'Cash', p_pay_date, 'payroll');

  IF p_uif_employee + p_uif_employer > 0 THEN
    INSERT INTO expenses (business_id, user_id, amount, sars_category, what_for, paid_to, payment_method, transaction_date, source)
    VALUES (p_business_id, v_user_id, p_uif_employee + p_uif_employer, 'Employee costs — UIF employer contribution', 'UIF — ' || p_worker_name, 'SARS', 'EFT / Bank transfer', p_pay_date, 'payroll');
  END IF;

  IF p_sdl > 0 THEN
    INSERT INTO expenses (business_id, user_id, amount, sars_category, what_for, paid_to, payment_method, transaction_date, source)
    VALUES (p_business_id, v_user_id, p_sdl, 'Employee costs — Skills development levy', 'SDL — ' || p_worker_name, 'SARS', 'EFT / Bank transfer', p_pay_date, 'payroll');
  END IF;

  IF p_loan_deducted > 0 THEN
    INSERT INTO worker_loans (business_id, user_id, staff_id, worker_name, loan_type, amount, note, entry_date)
    VALUES (p_business_id, v_user_id, p_staff_id, p_worker_name, 'repayment', p_loan_deducted, 'Deducted from wages ' || p_pay_date, p_pay_date);
  END IF;

  IF p_leave_days > 0 THEN
    INSERT INTO worker_leave (business_id, user_id, staff_id, worker_name, leave_type, days, start_date, note)
    VALUES (p_business_id, v_user_id, p_staff_id, p_worker_name, COALESCE(p_leave_type, 'Annual'), p_leave_days, p_pay_date, 'Recorded from Pay Run');
  END IF;

  RETURN v_pay_run;
END;
$$;
REVOKE EXECUTE ON FUNCTION create_pay_run(uuid, uuid, text, text, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, numeric, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_pay_run(uuid, uuid, text, text, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, numeric, text, numeric, text) TO authenticated;
