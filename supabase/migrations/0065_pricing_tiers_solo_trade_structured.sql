-- Pricing redesign Phase 1 — the tier re-carve.
--
-- Replaces the shoebox/solo/business model (R50/99/199) with the paid-only
-- three-tier model: Solo (R79) / Trade (R149) / Structured (R229), all
-- VAT-inclusive. Mirrors src/lib/tiers.ts — this is the authority, the client is
-- the courtesy. Keep the two in step.
--
-- The carve (client isLocked / entitlements, server plan_allows):
--   Solo       — owner only; money basics, quotes/invoices, cash-up, receipts.
--   Trade      — + staff logins (owner + up to 5), staff register & payroll,
--                purchase orders, supplier invoices, statements, age analysis,
--                recurring invoices.
--   Structured — + VAT201/EMP201/provisional tax/compliance + accountant pack;
--                unlimited staff logins.
--
-- Existing data (PayFast still sandbox, subscriptions empty): map plan values
-- shoebox->solo, solo->trade, business->structured. The reused id "solo" changes
-- meaning, so old Solo customers move to Trade (their staff + tools survive) and
-- the old Business account moves to Structured.

-- ── 1. Remap existing plan/tier data, then swap the CHECK constraints ─────────
-- Drop the old checks first so the business->structured remap doesn't trip them.
ALTER TABLE business_profiles DROP CONSTRAINT IF EXISTS business_profiles_plan_check;
ALTER TABLE subscriptions     DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

UPDATE business_profiles SET plan = CASE plan
  WHEN 'shoebox'  THEN 'solo'
  WHEN 'solo'     THEN 'trade'
  WHEN 'business' THEN 'structured'
  ELSE plan
END;

UPDATE subscriptions SET tier = CASE tier
  WHEN 'shoebox'  THEN 'solo'
  WHEN 'solo'     THEN 'trade'
  WHEN 'business' THEN 'structured'
  ELSE tier
END;

ALTER TABLE business_profiles ALTER COLUMN plan SET DEFAULT 'solo';
ALTER TABLE subscriptions     ALTER COLUMN tier SET DEFAULT 'solo';

ALTER TABLE business_profiles
  ADD CONSTRAINT business_profiles_plan_check CHECK (plan IN ('solo','trade','structured'));
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_tier_check CHECK (tier IN ('solo','trade','structured'));

-- ── 2. plan_allows(): the tier authority, mirroring isLocked() inverted ───────
CREATE OR REPLACE FUNCTION public.plan_allows(p_business_id uuid, p_tool text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT CASE
    -- Staff logins and recurring invoices are Trade+ (locked on Solo).
    WHEN p_tool IN ('team', 'invoice_recurring') THEN bp.plan IN ('trade', 'structured')
    -- Structured unlocks everything.
    WHEN bp.plan = 'structured' THEN true
    -- Trade unlocks everything except the Structured-only tax/compliance suite.
    WHEN bp.plan = 'trade' THEN p_tool <> ALL (ARRAY['vat201','emp201','provtax','compliance'])
    -- Solo is money-only: locked out of all Trade+ and Structured tools.
    WHEN bp.plan = 'solo' THEN p_tool <> ALL (ARRAY[
      'staffregister','payrun','advances','leave',
      'purchaseorder','supplierinvoice','remittance','statement','ageanalysis',
      'vat201','emp201','provtax','compliance'
    ])
    -- Unrecognised plan is not locked (matches isLocked); no business row -> NULL,
    -- which a policy treats as denied.
    ELSE true
  END
  FROM business_profiles bp
  WHERE bp.id = p_business_id;
$$;

-- ── 3. Staff register: no per-tier count cap any more ─────────────────────────
-- The old Solo "max 2 employees" cap is gone. Employee records are unlimited on
-- Trade+ (where staffregister is unlocked); the seat cap now lives on LOGINS
-- (business_members), not employee records. Recreate the policy without
-- staff_slots_available(), then drop the function.
DROP POLICY IF EXISTS insert_member ON public.staff_register;
CREATE POLICY insert_member ON public.staff_register FOR INSERT
  WITH CHECK (
    has_tool_access(business_id, 'staffregister', 'edit')
    AND plan_allows(business_id, 'staffregister')
  );
DROP FUNCTION IF EXISTS public.staff_slots_available(uuid);

-- ── 4. Login seat cap: owner + up to 5 on Trade, unlimited on Structured ──────
-- Counts accepted members + still-live pending invites (a pending invite is a
-- seat already spoken for). Solo returns false — team is owner-only there, and
-- plan_allows('team') already blocks the invite before this is reached.
CREATE OR REPLACE FUNCTION public.member_slots_available(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT CASE bp.plan
    WHEN 'structured' THEN true
    WHEN 'trade' THEN (
      (SELECT count(*) FROM business_members bm WHERE bm.business_id = p_business_id)
      + (SELECT count(*) FROM invites i
         WHERE i.business_id = p_business_id AND i.accepted_at IS NULL AND i.expires_at > now())
    ) < 6
    ELSE false
  END
  FROM business_profiles bp
  WHERE bp.id = p_business_id;
$$;

-- Inviting is the team feature AND consumes a login seat.
DROP POLICY IF EXISTS insert_member ON public.invites;
CREATE POLICY insert_member ON public.invites FOR INSERT
  WITH CHECK (
    is_business_member(business_id)
    AND plan_allows(business_id, 'team')
    AND member_slots_available(business_id)
  );

-- ── 5. plan_rank + the plan fallbacks in the sync trigger and downgrade path ──
CREATE OR REPLACE FUNCTION public.plan_rank(p_plan text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(array_position(ARRAY['solo','trade','structured']::text[], p_plan), 1);
$$;

-- Fallback floor when a subscription lapses is now 'solo' (the entry tier), not
-- the retired 'shoebox'. (The trial/read-only machinery in a later phase will
-- replace this with a proper read-only state rather than a silent tier drop.)
CREATE OR REPLACE FUNCTION public.sync_plan_from_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE business_profiles
  SET plan = CASE
        WHEN NEW.status IN ('active', 'past_due') THEN NEW.tier
        ELSE 'solo'
      END,
      updated_at = now()
  WHERE id = NEW.business_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_business_plan(target_business_id uuid, new_plan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  current_plan text;
BEGIN
  IF new_plan NOT IN ('solo', 'trade', 'structured') THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM business_members
    WHERE business_id = target_business_id AND user_id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only an owner can change the plan';
  END IF;

  SELECT bp.plan INTO current_plan FROM business_profiles bp WHERE bp.id = target_business_id;

  IF plan_rank(new_plan) > plan_rank(current_plan) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Upgrading requires payment — start a subscription instead'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE business_profiles SET plan = new_plan, updated_at = now() WHERE id = target_business_id;
END;
$$;

-- ── 6. Recurring-invoice generator: gate on Trade+ instead of 'business' ──────
-- CREATE OR REPLACE keeps 0044's grants (revoked from PUBLIC/anon/authenticated)
-- and the existing pg_cron schedule; only the plan gate changes.
CREATE OR REPLACE FUNCTION generate_recurring_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  t            record;
  v_created    integer := 0;
  v_doc        text;
  v_seq        integer;
  v_year       text;
  v_term_days  integer;
  v_new_id     uuid;
BEGIN
  FOR t IN
    SELECT i.*
    FROM invoices i
    JOIN business_profiles bp ON bp.id = i.business_id
    WHERE i.recurrence <> 'none'
      AND i.deleted_at IS NULL
      AND i.next_run_date IS NOT NULL
      AND i.next_run_date <= current_date
      AND bp.plan IN ('trade', 'structured')
    FOR UPDATE OF i
  LOOP
    WHILE t.next_run_date <= current_date LOOP
      v_year := to_char(t.next_run_date, 'YYYY');

      SELECT COALESCE(MAX((regexp_match(doc_number, '(\d{4})$'))[1]::int), 0) + 1
        INTO v_seq
      FROM invoices
      WHERE business_id = t.business_id
        AND doc_number LIKE 'INV-' || v_year || '-%';

      v_doc := 'INV-' || v_year || '-' || lpad(v_seq::text, 4, '0');
      v_term_days := COALESCE(t.due_date - t.issue_date, 30);

      INSERT INTO invoices (
        business_id, user_id, doc_number, client_contact_id, client_name,
        line_items, invoice_amount, deposit_received, balance_due,
        issue_date, due_date, status, vat_rate, vat_amount,
        recurrence, next_run_date, recurrence_parent_id
      ) VALUES (
        t.business_id, t.user_id, v_doc, t.client_contact_id, t.client_name,
        t.line_items, t.invoice_amount, 0, t.invoice_amount,
        t.next_run_date, t.next_run_date + v_term_days, 'unpaid', t.vat_rate, t.vat_amount,
        'none', NULL, t.id
      )
      RETURNING id INTO v_new_id;

      v_created := v_created + 1;
      t.next_run_date := recurrence_next(t.next_run_date, t.recurrence);
    END LOOP;

    UPDATE invoices SET next_run_date = t.next_run_date, updated_at = now() WHERE id = t.id;
  END LOOP;

  RETURN v_created;
END;
$$;

-- ── 7. Grants — same hardened shape as every other function here ──────────────
REVOKE EXECUTE ON FUNCTION public.plan_allows(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.member_slots_available(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.plan_rank(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_business_plan(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_allows(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_slots_available(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.plan_rank(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_business_plan(uuid, text) TO authenticated;
