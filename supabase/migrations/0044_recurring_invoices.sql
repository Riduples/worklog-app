-- Recurring invoices. An invoice with recurrence != 'none' acts as the
-- template: a nightly job copies it whenever next_run_date falls due and
-- advances the template's next_run_date. Generated copies are ordinary
-- invoices (recurrence 'none') that point back at the template so the UI can
-- show provenance and the template can be stopped without touching history.

ALTER TABLE invoices
  ADD COLUMN recurrence text NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none', 'weekly', 'monthly', 'quarterly', 'annual')),
  ADD COLUMN next_run_date date,
  ADD COLUMN recurrence_parent_id uuid REFERENCES invoices(id) ON DELETE SET NULL;

-- A template must have a next run date; a non-template must not.
ALTER TABLE invoices ADD CONSTRAINT invoices_recurrence_next_run_check
  CHECK ((recurrence = 'none' AND next_run_date IS NULL) OR (recurrence <> 'none' AND next_run_date IS NOT NULL));

CREATE INDEX idx_invoices_recurrence_due ON invoices(next_run_date)
  WHERE recurrence <> 'none' AND deleted_at IS NULL;
CREATE INDEX idx_invoices_recurrence_parent ON invoices(recurrence_parent_id);

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Advance a date by one recurrence step.
CREATE FUNCTION recurrence_next(p_from date, p_recurrence text)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $$
  SELECT CASE p_recurrence
    WHEN 'weekly'    THEN p_from + interval '7 days'
    WHEN 'monthly'   THEN p_from + interval '1 month'
    WHEN 'quarterly' THEN p_from + interval '3 months'
    WHEN 'annual'    THEN p_from + interval '1 year'
    ELSE NULL
  END::date;
$$;

-- Generates every invoice that has come due. Runs headless from pg_cron, so
-- there is no auth.uid() — hence SECURITY DEFINER and no RLS to lean on.
-- Deliberately re-checks the business plan: recurring invoices are a Business
-- feature, so a downgrade must stop generation rather than silently continue.
CREATE FUNCTION generate_recurring_invoices()
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
      AND bp.plan = 'business'
    FOR UPDATE OF i
  LOOP
    -- Catch up rather than skip: a template dormant for months still emits an
    -- invoice per missed period, so a downtime gap can't silently lose billing.
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

-- Cron-only: nothing in the app should be able to trigger a billing run.
REVOKE EXECUTE ON FUNCTION generate_recurring_invoices() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION recurrence_next(date, text) FROM PUBLIC, anon;

SELECT cron.schedule(
  'generate-recurring-invoices',
  '15 1 * * *', -- 01:15 UTC daily (~03:15 SAST), safely outside month-end boundaries
  $$SELECT public.generate_recurring_invoices();$$
);
