-- 0085 (Phase D3): leave end-date + unpaid leave actually reduces pay.
--
-- worker_leave gains an end date (when the employee returns). pay_runs records
-- the unpaid-leave deduction so a payslip can print it and it isn't lost. Only
-- "Unpaid" leave reduces pay — paid leave (annual/sick/family) is still recorded
-- for balances only. The client computes net_pay (already net of unpaid leave)
-- and passes the unpaid amount so create_pay_run can store it on the run.

ALTER TABLE worker_leave
  ADD COLUMN end_date date;

ALTER TABLE pay_runs
  ADD COLUMN unpaid_leave_amount numeric(12,2) NOT NULL DEFAULT 0;

-- Replace create_pay_run with a version that takes + stores p_unpaid_leave_amount.
-- Adding a parameter changes the signature, so DROP the old (21-arg) function
-- first — CREATE OR REPLACE would otherwise leave a second overload behind.
DROP FUNCTION IF EXISTS create_pay_run(
  uuid, uuid, text, text, date, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric, text, numeric, text, numeric, text
);

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
  p_unpaid_leave_amount numeric,
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
  v_year text := to_char(p_pay_date, 'YYYY');
  v_next int;
  v_payslip_number text;
BEGIN
  IF p_status NOT IN ('prepared', 'approved') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT COALESCE(MAX((regexp_replace(payslip_number, '^PS-\d{4}-', ''))::int), 0) + 1
    INTO v_next
  FROM pay_runs
  WHERE business_id = p_business_id
    AND payslip_number LIKE 'PS-' || v_year || '-%';
  v_payslip_number := 'PS-' || v_year || '-' || lpad(v_next::text, 4, '0');

  INSERT INTO pay_runs (
    business_id, user_id, staff_id, worker_name, pay_period, pay_date,
    units_worked, base_rate, overtime_amount, allowances_amount, gross_wages,
    uif_employee, uif_employer, uif_total, paye, sdl, loan_deducted,
    other_deductions, other_deduction_desc, leave_days, leave_type,
    unpaid_leave_amount, net_pay, status, approved_by, approved_at, payslip_number
  ) VALUES (
    p_business_id, v_user_id, p_staff_id, p_worker_name, p_pay_period, p_pay_date,
    p_units_worked, p_base_rate, p_overtime_amount, p_allowances_amount, p_gross_wages,
    p_uif_employee, p_uif_employer, p_uif_employee + p_uif_employer, p_paye, p_sdl, p_loan_deducted,
    p_other_deductions, p_other_deduction_desc, p_leave_days, p_leave_type,
    p_unpaid_leave_amount, p_net_pay, p_status,
    CASE WHEN p_status = 'approved' THEN v_user_id ELSE NULL END,
    CASE WHEN p_status = 'approved' THEN now() ELSE NULL END,
    v_payslip_number
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

REVOKE EXECUTE ON FUNCTION create_pay_run(uuid, uuid, text, text, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, numeric, text, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_pay_run(uuid, uuid, text, text, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, numeric, text, numeric, numeric, text) TO authenticated;
