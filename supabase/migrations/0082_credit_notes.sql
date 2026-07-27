-- 0082: Credit Notes — VAT-correct credits against customer and supplier invoices.
--
-- A credit note reverses part or all of an issued invoice. SARS requires it to
-- reference the original invoice and, for a VAT-registered business, reverse the
-- VAT portion. Built to the final end-state (no standalone register): credits
-- surface and settle on the customer statement, supplier remittance, age
-- analysis, and the credited invoice's detail (which sends the SARS document).
--
-- Money model (same VAT direction as income/invoices):
--   amount     = the credit total, VAT-INCLUSIVE for a VAT business (it mirrors
--                the invoice line totals it reverses).
--   vat_amount = the VAT portion contained WITHIN amount (backed out at vat_rate:
--                amount - amount/(1+rate)).
-- A credit note reduces revenue/cost and output/input VAT the moment it is
-- raised. If it is later REFUNDED in cash, that refund is booked as a normal
-- income/expense flagged is_credit_settlement so Profit & Loss does not hit
-- profit a second time (the credit note already did) while Cash Flow still
-- counts the money actually moving.

CREATE TABLE credit_notes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id),
  doc_number            text NOT NULL,                 -- CN-YYYY-NNNN
  ledger                text NOT NULL CHECK (ledger IN ('customer', 'supplier')),

  -- Reference to the original invoice (one side set per ledger). SET NULL on a
  -- hard delete of the source; original_doc_number keeps the SARS reference.
  invoice_id            uuid REFERENCES invoices(id) ON DELETE SET NULL,
  supplier_invoice_id   uuid REFERENCES supplier_invoices(id) ON DELETE SET NULL,
  original_doc_number   text,

  contact_id            uuid REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name          text NOT NULL,

  amount                numeric(12,2) NOT NULL,        -- credit total (incl VAT if registered)
  vat_rate              numeric(5,4),
  vat_amount            numeric(12,2) NOT NULL DEFAULT 0,   -- VAT portion within amount

  scope                 text NOT NULL DEFAULT 'whole' CHECK (scope IN ('whole', 'lines')),
  line_items            jsonb NOT NULL DEFAULT '[]',   -- credited lines when scope='lines'
  reason                text,

  -- How it was applied at raise time. 'reduce' lowered the invoice balance;
  -- 'account' held the whole credit on account. Either way, any amount not
  -- applied against the invoice sits in on_account_balance until settled.
  settlement            text NOT NULL DEFAULT 'account' CHECK (settlement IN ('reduce', 'account')),
  on_account_balance    numeric(12,2) NOT NULL DEFAULT 0,

  -- Current state. 'on_account' = still owed back / owed to you (offers settle
  -- actions); 'applied' = used against another invoice; 'refunded' = paid out in
  -- cash (which books an is_credit_settlement expense/income).
  status                text NOT NULL DEFAULT 'on_account' CHECK (status IN ('on_account', 'applied', 'refunded')),

  issue_date            date NOT NULL,
  deleted_at            timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),

  -- VAT can never exceed the amount it was contained in.
  CONSTRAINT credit_notes_vat_within_amount CHECK (vat_amount >= 0 AND vat_amount <= amount),
  -- The non-matching invoice reference must be empty for the ledger side.
  CONSTRAINT credit_notes_ledger_ref CHECK (
    (ledger = 'customer' AND supplier_invoice_id IS NULL)
    OR (ledger = 'supplier' AND invoice_id IS NULL)
  )
);

CREATE INDEX idx_credit_notes_business ON credit_notes(business_id);
CREATE INDEX idx_credit_notes_invoice ON credit_notes(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_credit_notes_supplier_invoice ON credit_notes(supplier_invoice_id) WHERE supplier_invoice_id IS NOT NULL;

ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

-- Same access shape as the other shared business data (bank_accounts): any member
-- can read; create/edit require a writable (non-read-only / non-trial-expired)
-- business.
CREATE POLICY "select_member" ON credit_notes FOR SELECT
  USING (is_business_member(business_id));
CREATE POLICY "insert_member" ON credit_notes FOR INSERT
  WITH CHECK (is_business_member(business_id) AND business_is_writable(business_id));
CREATE POLICY "update_member" ON credit_notes FOR UPDATE
  USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id) AND business_is_writable(business_id));

-- Refund settlements. A credit-note refund books a normal expense (customer) or
-- income (supplier), flagged so Profit & Loss excludes it (the credit note
-- already adjusted profit) while Cash Flow still counts the cash. credit_note_id
-- ties the settlement back to the credit for traceability.
ALTER TABLE income
  ADD COLUMN is_credit_settlement boolean NOT NULL DEFAULT false,
  ADD COLUMN credit_note_id uuid REFERENCES credit_notes(id) ON DELETE SET NULL;
ALTER TABLE expenses
  ADD COLUMN is_credit_settlement boolean NOT NULL DEFAULT false,
  ADD COLUMN credit_note_id uuid REFERENCES credit_notes(id) ON DELETE SET NULL;

-- A fully-credited invoice moves to a distinct 'credited' status: neither still
-- owed (excluded from debtors) nor paid in cash.
ALTER TABLE invoices DROP CONSTRAINT invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'overdue'::text, 'partial'::text, 'credited'::text]));

ALTER TABLE supplier_invoices DROP CONSTRAINT supplier_invoices_status_check;
ALTER TABLE supplier_invoices ADD CONSTRAINT supplier_invoices_status_check
  CHECK (status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'overdue'::text, 'credited'::text]));

-- The sendable SARS "Credit Note" document.
ALTER TABLE generated_documents DROP CONSTRAINT generated_documents_document_type_check;
ALTER TABLE generated_documents ADD CONSTRAINT generated_documents_document_type_check
  CHECK (document_type = ANY (ARRAY['quote'::text, 'invoice'::text, 'purchaseorder'::text, 'payslip'::text, 'creditnote'::text]));
