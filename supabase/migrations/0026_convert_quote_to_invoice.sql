CREATE OR REPLACE FUNCTION convert_quote_to_invoice(
  p_quote_id UUID,
  p_doc_number TEXT,
  p_line_items JSONB,
  p_invoice_amount NUMERIC,
  p_deposit_received NUMERIC,
  p_vat_rate NUMERIC,
  p_vat_amount NUMERIC,
  p_issue_date DATE,
  p_due_date DATE
)
RETURNS invoices
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_quote quotes%ROWTYPE;
  v_invoice invoices%ROWTYPE;
BEGIN
  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  INSERT INTO invoices (
    user_id, doc_number, client_contact_id, client_name, line_items,
    invoice_amount, deposit_received, balance_due, issue_date, due_date,
    status, converted_from_quote_id, vat_rate, vat_amount
  ) VALUES (
    v_quote.user_id, p_doc_number, v_quote.client_contact_id, v_quote.client_name, p_line_items,
    p_invoice_amount, p_deposit_received, p_invoice_amount - COALESCE(p_deposit_received, 0),
    p_issue_date, p_due_date, 'unpaid', v_quote.id, p_vat_rate, p_vat_amount
  )
  RETURNING * INTO v_invoice;

  UPDATE quotes SET status = 'converted', converted_to_invoice_id = v_invoice.id, updated_at = now()
  WHERE id = p_quote_id;

  RETURN v_invoice;
END;
$$;
