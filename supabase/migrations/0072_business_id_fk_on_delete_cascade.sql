-- 0072 — add ON DELETE CASCADE to the 14 legacy business_id foreign keys.
--
-- Migration 0030 added business_id to the original tenant tables with a plain
-- REFERENCES business_profiles(id) — i.e. ON DELETE NO ACTION. Every table added
-- since (bank_accounts, account_transfers, cash_ups, pay_runs, staff_register,
-- worker_loans, worker_leave, tax_filings, invites, business_members,
-- subscriptions) uses ON DELETE CASCADE, so these 14 are the odd ones out.
--
-- Consequence of the gap: deleting a business_profiles row is blocked the moment
-- any of these tables holds a row for it (a staff-authored record keeps its own
-- user_id, so it survives an owner's auth.users delete and then RESTRICTs the
-- business delete). That makes a clean account/POPIA erasure impossible. Bringing
-- them in line with the newer tables lets a business delete cascade to its own
-- records, exactly as the rest of the schema already does. payment_events keeps
-- its deliberate ON DELETE SET NULL (the payment audit trail must outlive the
-- business), so it is intentionally excluded here.
--
-- NOTE: this makes deleting a business_profiles row hard-delete all of its
-- financial records. There is no user-facing or automated delete-business path in
-- the app (everything is soft-delete via deleted_at); a business row is only ever
-- removed by a deliberate admin/erasure action, which is precisely when the
-- cascade is wanted.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bookings', 'contacts', 'expenses', 'generated_documents', 'income',
    'invoices', 'ledger_entries', 'mileage_trips', 'purchase_orders', 'quotes',
    'recipes', 'stock_items', 'supplier_invoices', 'time_entries'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, t || '_business_id_fkey');
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (business_id) REFERENCES business_profiles(id) ON DELETE CASCADE',
      t, t || '_business_id_fkey'
    );
  END LOOP;
END $$;
