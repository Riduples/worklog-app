-- create_pay_run was missing SET search_path, matching the same mutable-
-- search-path gap fixed for convert_quote_to_invoice in 0027_harden_functions.sql.
CREATE OR REPLACE FUNCTION create_pay_run(
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
SET search_path = public, pg_catalog
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
