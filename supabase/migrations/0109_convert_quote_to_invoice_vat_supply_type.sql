-- 0109: carry the VAT supply type through quote→invoice conversion.
--
-- 0108 added invoices.vat_supply_type, but convert_quote_to_invoice still
-- inserted without it, so every converted invoice fell back to the column
-- default ('standard') — a zero-rated or exempt quote became standard-rated the
-- moment it was converted. Add p_vat_supply_type (DEFAULT 'standard' so existing
-- callers are unaffected) and stamp it on the new invoice. Drop the old 10-arg
-- signature first so the 11-arg version isn't an ambiguous overload.
DROP FUNCTION IF EXISTS public.convert_quote_to_invoice(uuid, text, jsonb, numeric, numeric, numeric, numeric, date, date, text);

CREATE OR REPLACE FUNCTION public.convert_quote_to_invoice(
  p_quote_id uuid, p_doc_number text, p_line_items jsonb, p_invoice_amount numeric,
  p_deposit_received numeric, p_vat_rate numeric, p_vat_amount numeric,
  p_issue_date date, p_due_date date, p_terms text DEFAULT NULL,
  p_vat_supply_type text DEFAULT 'standard')
 RETURNS invoices
 LANGUAGE plpgsql
 SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_quote quotes%ROWTYPE;
  v_invoice invoices%ROWTYPE;
BEGIN
  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  INSERT INTO invoices (
    user_id, business_id, doc_number, client_contact_id, client_name, line_items,
    invoice_amount, deposit_received, balance_due, issue_date, due_date,
    status, converted_from_quote_id, vat_rate, vat_amount, terms, vat_supply_type
  ) VALUES (
    v_quote.user_id, v_quote.business_id, p_doc_number, v_quote.client_contact_id, v_quote.client_name, p_line_items,
    p_invoice_amount, p_deposit_received, p_invoice_amount - COALESCE(p_deposit_received, 0),
    p_issue_date, p_due_date, 'unpaid', v_quote.id, p_vat_rate, p_vat_amount, p_terms, COALESCE(p_vat_supply_type, 'standard')
  )
  RETURNING * INTO v_invoice;

  UPDATE quotes SET status = 'converted', converted_to_invoice_id = v_invoice.id, updated_at = now()
  WHERE id = p_quote_id;

  RETURN v_invoice;
END;
$function$;
