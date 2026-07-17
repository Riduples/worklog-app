-- Server-side tier enforcement.
--
-- worklog-build-instructions.md §5: "Move the actual enforcement server-side
-- (an API that checks the subscription tier) -- client-side gating alone isn't
-- secure once there's real money involved."
--
-- It wasn't even secure against the address bar. isLocked() only decides
-- whether a dashboard TILE renders with a padlock; no route or policy checked
-- the plan. A Shoebox user could type /staff and use the full Staff Register.
-- With billing wired up that is revenue leakage requiring no skill at all.
--
-- NOTE this is necessary but not sufficient: it trusts business_profiles.plan,
-- and update_business_plan() currently lets any owner set that themselves. Not
-- closed until a plan can only change via a verified payment (PayFast ITN).
--
-- Mirrors isLocked() in src/lib/tiers.ts exactly, inverted. Keep the two in
-- step: this is the authority, the client is the courtesy.
--
-- (0053 immediately follows: this version gates recurring invoices on the
-- 'team' rule, which is right by coincidence and wrong by design.)
CREATE OR REPLACE FUNCTION public.plan_allows(p_business_id uuid, p_tool text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT CASE
    -- SOLO_NO_TEAM: multi-user is Business-only.
    WHEN p_tool = 'team' THEN bp.plan = 'business'
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

-- SOLO_RESTRICTED.staffregister.limit in src/lib/tiers.ts. Duplicated here
-- because there is nowhere shared to read it from; if that limit changes, this
-- has to change with it.
CREATE OR REPLACE FUNCTION public.staff_slots_available(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT CASE
    WHEN bp.plan = 'solo' THEN (
      SELECT count(*) FROM staff_register s
      WHERE s.business_id = p_business_id AND s.deleted_at IS NULL
    ) < 2
    ELSE true
  END
  FROM business_profiles bp
  WHERE bp.id = p_business_id;
$$;

REVOKE EXECUTE ON FUNCTION public.plan_allows(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.staff_slots_available(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_allows(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_slots_available(uuid) TO authenticated;

-- Only INSERT is gated, deliberately.
--
-- SELECT stays open: downgrading must never make a business's own records
-- vanish. UPDATE stays open for the same reason -- they must still be able to
-- correct or remove what they already have, and soft delete is an UPDATE.
-- What a plan buys is the right to add more.
DO $$
DECLARE
  m record;
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      ('staff_register',    'staffregister'),
      ('pay_runs',          'payrun'),
      ('worker_loans',      'advances'),
      ('worker_leave',      'leave'),
      ('purchase_orders',   'purchaseorder'),
      ('supplier_invoices', 'supplierinvoice')
    ) AS t(tbl, tool)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS insert_member ON public.%I', m.tbl);
    EXECUTE format(
      'CREATE POLICY insert_member ON public.%I FOR INSERT WITH CHECK (
         has_tool_access(business_id, %L, ''edit'') AND plan_allows(business_id, %L)
       )', m.tbl, m.tool, m.tool);
  END LOOP;
END $$;

-- pay_runs also needs 'approve' to write an approved run (from 0047).
DROP POLICY IF EXISTS insert_member ON public.pay_runs;
CREATE POLICY insert_member ON public.pay_runs FOR INSERT
  WITH CHECK (
    has_tool_access(business_id, 'payrun', 'edit')
    AND plan_allows(business_id, 'payrun')
    AND (status IS DISTINCT FROM 'approved' OR has_tool_access(business_id, 'payrun', 'approve'))
  );

-- Solo caps the staff register at 2 employees.
DROP POLICY IF EXISTS insert_member ON public.staff_register;
CREATE POLICY insert_member ON public.staff_register FOR INSERT
  WITH CHECK (
    has_tool_access(business_id, 'staffregister', 'edit')
    AND plan_allows(business_id, 'staffregister')
    AND staff_slots_available(business_id)
  );

-- tax_filings picks its tool per row: vat201 is Shoebox-locked, emp201 is
-- locked on Shoebox and Solo both.
DROP POLICY IF EXISTS insert_member ON public.tax_filings;
CREATE POLICY insert_member ON public.tax_filings FOR INSERT
  WITH CHECK (
    has_tool_access(business_id, filing_type, 'edit')
    AND plan_allows(business_id, filing_type)
  );

-- Inviting someone is the team feature. business_members has no INSERT policy
-- of its own -- rows are only created by accept_invite() -- so the invite is
-- the gate.
DROP POLICY IF EXISTS insert_member ON public.invites;
CREATE POLICY insert_member ON public.invites FOR INSERT
  WITH CHECK (is_business_member(business_id) AND plan_allows(business_id, 'team'));

-- Recurring invoices are Business-only (SOLO_RESTRICTED.invoice.recurring).
-- generate_recurring_invoices() already re-checks the plan before generating,
-- so this stops the flag being set at all rather than being set and ignored.
DROP POLICY IF EXISTS insert_member ON public.invoices;
CREATE POLICY insert_member ON public.invoices FOR INSERT
  WITH CHECK (
    has_tool_access(business_id, 'invoice', 'edit')
    AND (recurrence = 'none' OR recurrence IS NULL OR plan_allows(business_id, 'team'))
  );

DROP POLICY IF EXISTS update_member ON public.invoices;
CREATE POLICY update_member ON public.invoices FOR UPDATE
  USING (has_tool_access(business_id, 'invoice', 'edit'))
  WITH CHECK (
    has_tool_access(business_id, 'invoice', 'edit')
    AND (deleted_at IS NULL OR has_tool_access(business_id, 'invoice', 'full'))
    AND (recurrence = 'none' OR recurrence IS NULL OR plan_allows(business_id, 'team'))
  );
