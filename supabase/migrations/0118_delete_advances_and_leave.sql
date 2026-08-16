-- 0118: let a manually-recorded advance or leave entry be deleted.
--
-- worker_loans and worker_leave had SELECT/INSERT/UPDATE policies (0047) and no
-- DELETE policy at all, so with RLS's default-deny there was no way to remove a
-- mis-typed entry — the row could only be edited into something else. Every other
-- list tool (customers, suppliers, trips, stock, time) lets you remove a row, and
-- those two dashboards were the odd ones out.
--
-- Neither table carries deleted_at, so this is a hard DELETE, matching how
-- pay_runs is voided (0117). Nothing reads history out of these rows: the loan and
-- leave balances are recomputed from whatever rows exist, so removing one simply
-- takes it back out of the balance.
--
-- 'full' is the level required, the same bar soft delete is held to elsewhere
-- (0047 expresses that as "setting deleted_at requires full").

-- Advances only. A 'repayment' row is written by create_pay_run, not by a person,
-- and is owned by the run that created it — it disappears when that run is voided
-- (0117's ON DELETE CASCADE) and must not be removable on its own, or the advance
-- balance would silently climb back up. pay_run_id IS NULL is belt-and-braces for
-- the same reason: anything a pay run created belongs to the pay run.
CREATE POLICY delete_member ON public.worker_loans FOR DELETE
  USING (
    has_tool_access(business_id, 'advances', 'full')
    AND loan_type = 'advance'
    AND pay_run_id IS NULL
  );

-- Manually-recorded leave only, for the same reason: leave booked by a pay run is
-- that run's record, reversed by voiding it.
CREATE POLICY delete_member ON public.worker_leave FOR DELETE
  USING (
    has_tool_access(business_id, 'leave', 'full')
    AND pay_run_id IS NULL
  );

-- Note: a foreign key's ON DELETE CASCADE is a referential-integrity action and is
-- not subject to RLS, so voiding a pay run still removes its own repayment and
-- leave rows despite the pay_run_id IS NULL conditions above.
