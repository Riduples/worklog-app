-- Enforce per-tool permissions in RLS.
--
-- Until now every INSERT/UPDATE policy was is_business_member(business_id):
-- tenancy only. Any member could write anything in the business whatever the
-- owner granted them, so the permissions matrix was decorative.
--
-- Soft delete is an UPDATE that sets deleted_at, so "edit but not delete" is
-- expressed in WITH CHECK: setting deleted_at requires 'full'.
DO $$
DECLARE
  m record;
  has_soft_delete boolean;
  update_check text;
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      ('income',            'income'),
      ('expenses',          'expense'),
      ('invoices',          'invoice'),
      ('quotes',            'quote'),
      ('purchase_orders',   'purchaseorder'),
      ('supplier_invoices', 'supplierinvoice'),
      ('stock_items',       'stock'),
      ('recipes',           'recipe'),
      ('bookings',          'booking'),
      ('time_entries',      'timetrack'),
      ('mileage_trips',     'mileage'),
      ('ledger_entries',    'ledger'),
      ('staff_register',    'staffregister'),
      ('worker_loans',      'advances'),
      ('worker_leave',      'leave'),
      ('cash_ups',          'cashup')
    ) AS t(tbl, tool)
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=m.tbl AND column_name='deleted_at'
    ) INTO has_soft_delete;

    EXECUTE format('DROP POLICY IF EXISTS select_member ON public.%I', m.tbl);
    EXECUTE format('DROP POLICY IF EXISTS insert_member ON public.%I', m.tbl);
    EXECUTE format('DROP POLICY IF EXISTS update_member ON public.%I', m.tbl);

    EXECUTE format(
      'CREATE POLICY select_member ON public.%I FOR SELECT USING (has_tool_access(business_id, %L, ''view''))',
      m.tbl, m.tool);

    EXECUTE format(
      'CREATE POLICY insert_member ON public.%I FOR INSERT WITH CHECK (has_tool_access(business_id, %L, ''edit''))',
      m.tbl, m.tool);

    IF has_soft_delete THEN
      update_check := format(
        'has_tool_access(business_id, %L, ''edit'') AND (deleted_at IS NULL OR has_tool_access(business_id, %L, ''full''))',
        m.tool, m.tool);
    ELSE
      update_check := format('has_tool_access(business_id, %L, ''edit'')', m.tool);
    END IF;

    EXECUTE format(
      'CREATE POLICY update_member ON public.%I FOR UPDATE USING (has_tool_access(business_id, %L, ''edit'')) WITH CHECK (%s)',
      m.tbl, m.tool, update_check);
  END LOOP;
END $$;

-- pay_runs is the one table where 'approve' is a real distinction rather than
-- a label: PayRunView saves status 'approved' only when canApprove(), so the
-- server has to hold that line too or the client check is decorative.
DROP POLICY IF EXISTS select_member ON public.pay_runs;
DROP POLICY IF EXISTS insert_member ON public.pay_runs;
DROP POLICY IF EXISTS update_member ON public.pay_runs;

CREATE POLICY select_member ON public.pay_runs FOR SELECT
  USING (has_tool_access(business_id, 'payrun', 'view'));

CREATE POLICY insert_member ON public.pay_runs FOR INSERT
  WITH CHECK (
    has_tool_access(business_id, 'payrun', 'edit')
    AND (status IS DISTINCT FROM 'approved' OR has_tool_access(business_id, 'payrun', 'approve'))
  );

CREATE POLICY update_member ON public.pay_runs FOR UPDATE
  USING (has_tool_access(business_id, 'payrun', 'edit'))
  WITH CHECK (
    has_tool_access(business_id, 'payrun', 'edit')
    AND (status IS DISTINCT FROM 'approved' OR has_tool_access(business_id, 'payrun', 'approve'))
  );

-- contacts carries both tools in one table, split by contact_type.
DROP POLICY IF EXISTS select_member ON public.contacts;
DROP POLICY IF EXISTS insert_member ON public.contacts;
DROP POLICY IF EXISTS update_member ON public.contacts;

CREATE POLICY select_member ON public.contacts FOR SELECT
  USING (has_tool_access(business_id, CASE WHEN contact_type = 'supplier' THEN 'suppliers' ELSE 'clients' END, 'view'));

CREATE POLICY insert_member ON public.contacts FOR INSERT
  WITH CHECK (has_tool_access(business_id, CASE WHEN contact_type = 'supplier' THEN 'suppliers' ELSE 'clients' END, 'edit'));

CREATE POLICY update_member ON public.contacts FOR UPDATE
  USING (has_tool_access(business_id, CASE WHEN contact_type = 'supplier' THEN 'suppliers' ELSE 'clients' END, 'edit'))
  WITH CHECK (
    has_tool_access(business_id, CASE WHEN contact_type = 'supplier' THEN 'suppliers' ELSE 'clients' END, 'edit')
    AND (deleted_at IS NULL OR has_tool_access(business_id, CASE WHEN contact_type = 'supplier' THEN 'suppliers' ELSE 'clients' END, 'full'))
  );

-- tax_filings records "period marked as filed" per return type.
DROP POLICY IF EXISTS select_member ON public.tax_filings;
DROP POLICY IF EXISTS insert_member ON public.tax_filings;

CREATE POLICY select_member ON public.tax_filings FOR SELECT
  USING (has_tool_access(business_id, COALESCE(filing_type, 'taxdashboard'), 'view'));

CREATE POLICY insert_member ON public.tax_filings FOR INSERT
  WITH CHECK (has_tool_access(business_id, COALESCE(filing_type, 'taxdashboard'), 'edit'));
