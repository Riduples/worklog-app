-- 0047 gated tax_filings on COALESCE(filing_type, 'taxdashboard'). filing_type
-- is NOT NULL with CHECK (filing_type IN ('vat201','emp201')), so the fallback
-- could never fire -- and 'taxdashboard' has now been removed as a tool id
-- entirely, leaving the branch referring to something that doesn't exist.
-- Drop it: the column is always one of the two real tool ids.
DROP POLICY IF EXISTS select_member ON public.tax_filings;
DROP POLICY IF EXISTS insert_member ON public.tax_filings;

CREATE POLICY select_member ON public.tax_filings FOR SELECT
  USING (has_tool_access(business_id, filing_type, 'view'));

CREATE POLICY insert_member ON public.tax_filings FOR INSERT
  WITH CHECK (has_tool_access(business_id, filing_type, 'edit'));
