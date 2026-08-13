-- 0117: let a pay run be voided (deleted) with its side-effects reversed.
--
-- create_pay_run doesn't only write the pay_runs row — it also books the wage
-- (and UIF/SDL) as expenses, an advance 'repayment' that lowers the loan balance,
-- and a leave row that lowers the leave balance. None of those were linked back to
-- the run, so there was no safe way to undo a mistake: deleting the run would
-- leave the expense double-counted and the balances wrong.
--
-- This links each side-effect row to its pay run with an ON DELETE CASCADE foreign
-- key, backfills the existing rows, and opens a DELETE policy on pay_runs (approve
-- level — voiding a payslip is as significant as approving one). Deleting a pay run
-- now cascades to exactly the rows it created, restoring the advance and leave
-- balances and removing the payroll expense. The app re-issues a corrected run.

-- ── Link columns (additive, nullable, cascade on the parent's delete) ──
ALTER TABLE expenses      ADD COLUMN pay_run_id uuid REFERENCES pay_runs(id) ON DELETE CASCADE;
ALTER TABLE worker_loans  ADD COLUMN pay_run_id uuid REFERENCES pay_runs(id) ON DELETE CASCADE;
ALTER TABLE worker_leave  ADD COLUMN pay_run_id uuid REFERENCES pay_runs(id) ON DELETE CASCADE;

CREATE INDEX idx_expenses_pay_run     ON expenses(pay_run_id)     WHERE pay_run_id IS NOT NULL;
CREATE INDEX idx_worker_loans_pay_run ON worker_loans(pay_run_id) WHERE pay_run_id IS NOT NULL;
CREATE INDEX idx_worker_leave_pay_run ON worker_leave(pay_run_id) WHERE pay_run_id IS NOT NULL;

-- ── Backfill existing rows so runs created before this can be voided too ──
-- The side-effects carry no explicit key, so they're matched on the deterministic
-- shape create_pay_run wrote them with (business, worker/staff, pay date, and the
-- exact amount/description). Ambiguous only if the same worker had two runs on the
-- same date for the same figure — rare, and either run's void still reverses one
-- matching set.
UPDATE expenses e SET pay_run_id = pr.id
FROM pay_runs pr
WHERE e.pay_run_id IS NULL
  AND e.source = 'payroll'
  AND e.business_id = pr.business_id
  AND e.transaction_date = pr.pay_date
  AND e.what_for IN ('Wages — ' || pr.worker_name, 'UIF — ' || pr.worker_name, 'SDL — ' || pr.worker_name);

UPDATE worker_loans wl SET pay_run_id = pr.id
FROM pay_runs pr
WHERE wl.pay_run_id IS NULL
  AND wl.loan_type = 'repayment'
  AND wl.business_id = pr.business_id
  AND wl.staff_id = pr.staff_id
  AND wl.entry_date = pr.pay_date
  AND pr.loan_deducted > 0
  AND wl.amount = pr.loan_deducted;

UPDATE worker_leave wl SET pay_run_id = pr.id
FROM pay_runs pr
WHERE wl.pay_run_id IS NULL
  AND wl.note = 'Recorded from Pay Run'
  AND wl.business_id = pr.business_id
  AND wl.staff_id = pr.staff_id
  AND wl.start_date = pr.pay_date
  AND pr.leave_days > 0
  AND wl.days = pr.leave_days;

-- ── Allow the delete (voiding) at approve level ──
CREATE POLICY delete_member ON public.pay_runs FOR DELETE
  USING (has_tool_access(business_id, 'payrun', 'approve'));

-- ── Stamp pay_run_id on every side-effect the RPC writes ──
-- Same signature and behaviour as 0091; the only change is pay_run_id = the new
-- run's id on each child insert, so a later delete cascades to exactly these rows.
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

  INSERT INTO public.expenses (business_id, user_id, amount, sars_category, what_for, paid_to, payment_method, transaction_date, source, pay_run_id)
  VALUES (p_business_id, v_user_id, p_gross_wages, 'Employee costs — Salaries & wages', 'Wages — ' || p_worker_name, p_worker_name, 'Cash', p_pay_date, 'payroll', v_pay_run.id);

  IF p_uif_employee + p_uif_employer > 0 THEN
    INSERT INTO public.expenses (business_id, user_id, amount, sars_category, what_for, paid_to, payment_method, transaction_date, source, pay_run_id)
    VALUES (p_business_id, v_user_id, p_uif_employee + p_uif_employer, 'Employee costs — UIF employer contribution', 'UIF — ' || p_worker_name, 'SARS', 'EFT / Bank transfer', p_pay_date, 'payroll', v_pay_run.id);
  END IF;

  IF p_sdl > 0 THEN
    INSERT INTO public.expenses (business_id, user_id, amount, sars_category, what_for, paid_to, payment_method, transaction_date, source, pay_run_id)
    VALUES (p_business_id, v_user_id, p_sdl, 'Employee costs — Skills development levy', 'SDL — ' || p_worker_name, 'SARS', 'EFT / Bank transfer', p_pay_date, 'payroll', v_pay_run.id);
  END IF;

  IF p_loan_deducted > 0 THEN
    INSERT INTO public.worker_loans (business_id, user_id, staff_id, worker_name, loan_type, amount, note, entry_date, pay_run_id)
    VALUES (p_business_id, v_user_id, p_staff_id, p_worker_name, 'repayment', p_loan_deducted, 'Deducted from wages ' || p_pay_date, p_pay_date, v_pay_run.id);
  END IF;

  IF p_leave_days > 0 THEN
    INSERT INTO public.worker_leave (business_id, user_id, staff_id, worker_name, leave_type, days, start_date, note, pay_run_id)
    VALUES (p_business_id, v_user_id, p_staff_id, p_worker_name, COALESCE(p_leave_type, 'Annual'), p_leave_days, p_pay_date, 'Recorded from Pay Run', v_pay_run.id);
  END IF;

  RETURN v_pay_run;
END;
$$;
