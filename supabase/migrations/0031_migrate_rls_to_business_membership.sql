-- All rows backfilled cleanly (verified: zero NULLs across all 15 tables).
-- Lock in NOT NULL, index business_id, and swap every table's RLS from
-- raw user_id ownership to business membership via is_business_member().

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contacts', 'stock_items', 'recipes', 'quotes', 'invoices',
    'purchase_orders', 'supplier_invoices', 'income', 'expenses',
    'mileage_trips', 'time_entries', 'bookings', 'ledger_entries',
    'tax_records', 'generated_documents'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN business_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX idx_%I_business_id ON %I(business_id)', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "select_own" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "insert_own" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "update_own" ON %I', t);

    EXECUTE format('CREATE POLICY "select_member" ON %I FOR SELECT USING (is_business_member(business_id))', t);
    EXECUTE format('CREATE POLICY "insert_member" ON %I FOR INSERT WITH CHECK (is_business_member(business_id))', t);
    EXECUTE format('CREATE POLICY "update_member" ON %I FOR UPDATE USING (is_business_member(business_id)) WITH CHECK (is_business_member(business_id))', t);
  END LOOP;
END $$;
