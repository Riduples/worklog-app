-- 0052 gated recurring invoices on plan_allows(..., 'team'), which is right by
-- coincidence -- both happen to mean "Business only" -- and wrong by design:
-- changing the team rule would silently change recurring invoices with it.
--
-- 'invoice_recurring' is already the name this carries in UPGRADE_DETAILS
-- (src/lib/tiers.ts), so use it here too. It isn't a tool in TOOL_LABELS; it's
-- a restriction on the invoice tool (SOLO_RESTRICTED.invoice.recurring), which
-- is exactly why it needs its own id rather than borrowing another's.
CREATE OR REPLACE FUNCTION public.plan_allows(p_business_id uuid, p_tool text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT CASE
    -- Business-only, whatever the plan's other rules say.
    -- SOLO_NO_TEAM, and SOLO_RESTRICTED.invoice.recurring.
    WHEN p_tool IN ('team', 'invoice_recurring') THEN bp.plan = 'business'
    WHEN bp.plan = 'business' THEN true
    -- SOLO_LOCKED
    WHEN bp.plan = 'solo' THEN p_tool <> 'emp201'
    -- SHOEBOX_LOCKED
    WHEN bp.plan = 'shoebox' THEN p_tool <> ALL (ARRAY[
      'staffregister','payrun','advances','leave','emp201','vat201','provtax',
      'compliance','ageanalysis','purchaseorder','supplierinvoice','remittance','statement'
    ])
    -- An unrecognised plan is not locked, matching isLocked()'s own behaviour.
    -- No business row at all returns NULL, which a policy treats as denied.
    ELSE true
  END
  FROM business_profiles bp
  WHERE bp.id = p_business_id;
$$;

DROP POLICY IF EXISTS insert_member ON public.invoices;
CREATE POLICY insert_member ON public.invoices FOR INSERT
  WITH CHECK (
    has_tool_access(business_id, 'invoice', 'edit')
    AND (recurrence = 'none' OR recurrence IS NULL OR plan_allows(business_id, 'invoice_recurring'))
  );

DROP POLICY IF EXISTS update_member ON public.invoices;
CREATE POLICY update_member ON public.invoices FOR UPDATE
  USING (has_tool_access(business_id, 'invoice', 'edit'))
  WITH CHECK (
    has_tool_access(business_id, 'invoice', 'edit')
    AND (deleted_at IS NULL OR has_tool_access(business_id, 'invoice', 'full'))
    AND (recurrence = 'none' OR recurrence IS NULL OR plan_allows(business_id, 'invoice_recurring'))
  );
