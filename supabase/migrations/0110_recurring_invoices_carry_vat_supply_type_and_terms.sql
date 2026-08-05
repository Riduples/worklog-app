-- 0110: recurring invoices must inherit the template's VAT supply type and terms.
--
-- generate_recurring_invoices() copies a recurring template into each period's
-- child invoice, but its INSERT column list omitted vat_supply_type (added 0108)
-- and terms (added 0100). So a recurring EXEMPT invoice — e.g. monthly
-- residential rent — or a zero-rated one was regenerated every period as the
-- column default 'standard', misclassifying it on VAT201 (declared under
-- standard-rated supplies with no matching output VAT), and each child lost the
-- template's terms & conditions. The convert path was fixed for the same field in
-- 0109; this closes the sibling recurring path.
--
-- Recreated from the live definition with only the two fields added to the INSERT
-- (t.terms, and COALESCE(t.vat_supply_type,'standard') to satisfy the NOT NULL).
-- Everything else — the loop, doc-number allocation, plan/writable guards — is
-- byte-for-byte the current behaviour.
CREATE OR REPLACE FUNCTION public.generate_recurring_invoices()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
        issue_date, due_date, status, vat_rate, vat_amount, terms, vat_supply_type,
        recurrence, next_run_date, recurrence_parent_id
      ) VALUES (
        t.business_id, t.user_id, v_doc, t.client_contact_id, t.client_name,
        t.line_items, t.invoice_amount, 0, t.invoice_amount,
        t.next_run_date, t.next_run_date + v_term_days, 'unpaid', t.vat_rate, t.vat_amount,
        t.terms, COALESCE(t.vat_supply_type, 'standard'),
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
$function$;
