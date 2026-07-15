-- Tax Compliance suite (v2 Phase 10): VAT201/EMP201/ProvTax/AgeAnalysis/
-- Compliance Dashboard. Adds the business-profile fields the compliance
-- status checks depend on (paye_ref/sdl_registered/vat_period), and a
-- tax_filings log so "mark as filed" recency checks have something to read.

ALTER TABLE business_profiles
  ADD COLUMN paye_ref text,
  ADD COLUMN sdl_registered boolean NOT NULL DEFAULT false,
  ADD COLUMN vat_period text NOT NULL DEFAULT 'Bi-monthly' CHECK (vat_period IN ('Monthly', 'Bi-monthly'));

CREATE TABLE tax_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  filing_type text NOT NULL CHECK (filing_type IN ('vat201', 'emp201')),
  period_label text NOT NULL,
  filed_date date NOT NULL DEFAULT current_date,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_tax_filings_business_id ON tax_filings(business_id);

ALTER TABLE tax_filings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_member" ON tax_filings FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "insert_member" ON tax_filings FOR INSERT WITH CHECK (is_business_member(business_id));
