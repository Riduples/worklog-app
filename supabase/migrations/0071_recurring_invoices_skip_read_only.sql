-- 0071 — recurring invoices must skip read-only / expired-trial businesses.
--
-- generate_recurring_invoices() (migration 0065 §6) runs nightly via pg_cron as
-- SECURITY DEFINER, so it bypasses RLS — the has_tool_access read-only chokepoint
-- never sees it. It gated only on bp.plan IN ('trade','structured'), but a lapsed
-- trial keeps business_profiles.plan='structured' (sync_plan_from_subscription
-- holds the tier for trialing/read_only so the owner can still VIEW). The result:
-- an expired, non-paying business kept auto-minting a fresh invoice every cycle.
--
-- Fix: also require business_is_writable() in the WHERE clause. That function
-- returns TRUE when there is no subscription row at all, so legacy businesses
-- (created before the trial trigger) keep generating as before; it returns FALSE
-- only for a read_only status or a trial past its end — exactly the ones to skip.
-- Nothing else about the function changes.

CREATE OR REPLACE FUNCTION generate_recurring_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  t            record;
  v_created    integer := 0;
  v_doc        text;
  v_seq        integer;
  v_year       text;
  v_term_days  integer;
  v_new_id     uuid;
BEGIN
  FOR t IN
    SELECT i.*
    FROM invoices i
    JOIN business_profiles bp ON bp.id = i.business_id
    WHERE i.recurrence <> 'none'
      AND i.deleted_at IS NULL
      AND i.next_run_date IS NOT NULL
      AND i.next_run_date <= current_date
      AND bp.plan IN ('trade', 'structured')
      AND business_is_writable(i.business_id)
    FOR UPDATE OF i
  LOOP
    WHILE t.next_run_date <= current_date LOOP
      v_year := to_char(t.next_run_date, 'YYYY');

      SELECT COALESCE(MAX((regexp_match(doc_number, '(\d{4})$'))[1]::int), 0) + 1
        INTO v_seq
      FROM invoices
      WHERE business_id = t.business_id
        AND doc_number LIKE 'INV-' || v_year || '-%';

      v_doc := 'INV-' || v_year || '-' || lpad(v_seq::text, 4, '0');
      v_term_days := COALESCE(t.due_date - t.issue_date, 30);

      INSERT INTO invoices (
        business_id, user_id, doc_number, client_contact_id, client_name,
        line_items, invoice_amount, deposit_received, balance_due,
        issue_date, due_date, status, vat_rate, vat_amount,
        recurrence, next_run_date, recurrence_parent_id
      ) VALUES (
        t.business_id, t.user_id, v_doc, t.client_contact_id, t.client_name,
        t.line_items, t.invoice_amount, 0, t.invoice_amount,
        t.next_run_date, t.next_run_date + v_term_days, 'unpaid', t.vat_rate, t.vat_amount,
        'none', NULL, t.id
      )
      RETURNING id INTO v_new_id;

      v_created := v_created + 1;
      t.next_run_date := recurrence_next(t.next_run_date, t.recurrence);
    END LOOP;

    UPDATE invoices SET next_run_date = t.next_run_date, updated_at = now() WHERE id = t.id;
  END LOOP;

  RETURN v_created;
END;
$$;
