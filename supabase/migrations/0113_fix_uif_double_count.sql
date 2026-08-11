-- 0113: fix create_pay_run double-counting the employee's UIF in expenses.
--
-- p_gross_wages (booked as the 'Salaries & wages' expense) already contains the
-- employee's 1% UIF — it's a withholding out of gross, remitted to SARS on the
-- employee's behalf, not an extra cost. The function then ALSO booked
-- p_uif_employee + p_uif_employer as a second 'UIF employer contribution'
-- expense, so the employee's portion was expensed twice, overstating the
-- deductible cost by the employee UIF (~1% of gross, capped at the UIF ceiling).
--
-- Only the EMPLOYER's UIF is an incremental cost, so book p_uif_employer alone.
-- Everything else is identical to 0091 (SECURITY INVOKER + SET search_path = '',
-- every table reference schema-qualified); only the UIF expense changes.

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
  p_unpaid_leave_amount numeric,
  p_net_pay numeric,
  p_status text
)
RETURNS public.pay_runs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_pay_run public.pay_runs%ROWTYPE;
  v_year text := to_char(p_pay_date, 'YYYY');
  v_next int;
  v_payslip_number text;
BEGIN
  IF p_status NOT IN ('prepared', 'approved') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT COALESCE(MAX((regexp_replace(payslip_number, '^PS-\d{4}-', ''))::int), 0) + 1
    INTO v_next
  FROM public.pay_runs
  WHERE business_id = p_business_id
    AND payslip_number LIKE 'PS-' || v_year || '-%';
  v_payslip_number := 'PS-' || v_year || '-' || lpad(v_next::text, 4, '0');

  INSERT INTO public.pay_runs (
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

  INSERT INTO public.expenses (business_id, user_id, amount, sars_category, what_for, paid_to, payment_method, transaction_date, source)
  VALUES (p_business_id, v_user_id, p_gross_wages, 'Employee costs — Salaries & wages', 'Wages — ' || p_worker_name, p_worker_name, 'Cash', p_pay_date, 'payroll');

  -- Employer UIF only — the employee's 1% is already inside gross wages above.
  IF p_uif_employer > 0 THEN
    INSERT INTO public.expenses (business_id, user_id, amount, sars_category, what_for, paid_to, payment_method, transaction_date, source)
    VALUES (p_business_id, v_user_id, p_uif_employer, 'Employee costs — UIF employer contribution', 'UIF — ' || p_worker_name, 'SARS', 'EFT / Bank transfer', p_pay_date, 'payroll');
  END IF;

  IF p_sdl > 0 THEN
    INSERT INTO public.expenses (business_id, user_id, amount, sars_category, what_for, paid_to, payment_method, transaction_date, source)
    VALUES (p_business_id, v_user_id, p_sdl, 'Employee costs — Skills development levy', 'SDL — ' || p_worker_name, 'SARS', 'EFT / Bank transfer', p_pay_date, 'payroll');
  END IF;

  IF p_loan_deducted > 0 THEN
    INSERT INTO public.worker_loans (business_id, user_id, staff_id, worker_name, loan_type, amount, note, entry_date)
    VALUES (p_business_id, v_user_id, p_staff_id, p_worker_name, 'repayment', p_loan_deducted, 'Deducted from wages ' || p_pay_date, p_pay_date);
  END IF;

  IF p_leave_days > 0 THEN
    INSERT INTO public.worker_leave (business_id, user_id, staff_id, worker_name, leave_type, days, start_date, note)
    VALUES (p_business_id, v_user_id, p_staff_id, p_worker_name, COALESCE(p_leave_type, 'Annual'), p_leave_days, p_pay_date, 'Recorded from Pay Run');
  END IF;

  RETURN v_pay_run;
END;
$$;

-- Correct any historical rows the previous version double-counted: the UIF
-- payroll expense was booked at uif_employee + uif_employer (= pay_runs.uif_total)
-- but should be uif_employer alone. Idempotent — only rows still at the doubled
-- amount, where employee UIF was actually withheld (uif_employer < uif_total).
-- As of this migration there are 0 such rows in prod (no payroll had been run);
-- this makes the fix self-correcting for any that ever exist.
UPDATE public.expenses e
SET amount = pr.uif_employer
FROM public.pay_runs pr
WHERE e.source = 'payroll'
  AND e.sars_category = 'Employee costs — UIF employer contribution'
  AND e.business_id = pr.business_id
  AND e.transaction_date = pr.pay_date
  AND e.what_for = 'UIF — ' || pr.worker_name
  AND e.amount = pr.uif_total
  AND pr.uif_employer < pr.uif_total;
