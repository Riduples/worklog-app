-- Add business_id to every tenant-scoped table and backfill from the owning
-- user's existing business_profiles row. worker_payments/chair_rentals are
-- deliberately skipped (deprecated, will be dropped by the payroll rebuild).

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
    EXECUTE format('ALTER TABLE %I ADD COLUMN business_id uuid REFERENCES business_profiles(id)', t);
    EXECUTE format(
      'UPDATE %I SET business_id = bp.id FROM business_profiles bp WHERE bp.user_id = %I.user_id',
      t, t
    );
  END LOOP;
END $$;
