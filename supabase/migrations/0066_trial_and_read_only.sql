-- Pricing redesign Phase 1 — 30-day trial + the shared read-only state.
--
-- Every new business gets a 30-day trial with Structured (top-tier) entitlements
-- and no card. When the 30 days pass without a paid plan, the business drops to a
-- READ-ONLY state (shared later by dunning and pause): it can still view and
-- export everything, but can't create, edit or delete. There is deliberately no
-- free tier to fall back to.
--
-- Read-only is enforced at the one chokepoint every write already passes
-- through: has_tool_access(). Every table's INSERT/UPDATE policy calls it at
-- 'edit'+ and every SELECT at 'view' (migration 0047), so denying write-level
-- access for a read-only business blocks all writes while leaving reads and
-- exports untouched — without editing 40+ policies.

-- ── 1. New subscription statuses: trialing + read_only ───────────────────────
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active','past_due','cancelled','trialing','read_only'));

-- ── 2. Every new business starts a 30-day Structured trial ───────────────────
-- Fires alongside create_owner_membership() on business creation. The sync
-- trigger below then moves business_profiles.plan to 'structured' for the trial.
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO subscriptions (business_id, tier, status, current_period_end)
  VALUES (NEW.id, 'structured', 'trialing', now() + interval '30 days')
  ON CONFLICT (business_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_trial_subscription ON business_profiles;
CREATE TRIGGER trg_create_trial_subscription
  AFTER INSERT ON business_profiles
  FOR EACH ROW EXECUTE FUNCTION create_trial_subscription();

-- ── 3. Plan sync: trialing/read_only keep the tier ───────────────────────────
-- A trialing or read-only business keeps its tier so it can still VIEW all its
-- data (read-only is enforced separately, on writes). Only a cancelled
-- subscription drops to the entry floor.
CREATE OR REPLACE FUNCTION public.sync_plan_from_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE business_profiles
  SET plan = CASE
        WHEN NEW.status IN ('active','past_due','trialing','read_only') THEN NEW.tier
        ELSE 'solo'
      END,
      updated_at = now()
  WHERE id = NEW.business_id;
  RETURN NEW;
END;
$$;

-- ── 4. Writability: read_only, or a trial whose 30 days have elapsed ──────────
-- The elapsed-trial branch makes expiry take effect the moment the clock runs
-- out, without waiting for the nightly job below. No subscription -> writable
-- (existing accounts, and belt-and-braces).
CREATE OR REPLACE FUNCTION public.business_is_writable(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.business_id = p_business_id
      AND (
        s.status = 'read_only'
        OR (s.status = 'trialing' AND s.current_period_end < now())
      )
  );
$$;

-- ── 5. The write chokepoint: read-only denies edit+ but never view ───────────
-- The CASE guarantees the writability lookup runs only for write-level requests,
-- so SELECT policies (which call this at 'view', per row) never pay for it.
CREATE OR REPLACE FUNCTION public.has_tool_access(p_business_id uuid, p_tool text, p_min_level text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    CASE
      WHEN tool_access_rank(p_min_level) >= tool_access_rank('edit')
        THEN business_is_writable(p_business_id)
      ELSE true
    END
    AND EXISTS (
      SELECT 1
      FROM business_members bm
      WHERE bm.business_id = p_business_id
        AND bm.user_id = auth.uid()
        AND (
          bm.role = 'owner'
          OR tool_access_rank(bm.permissions ->> p_tool) >= tool_access_rank(p_min_level)
        )
    );
$$;

-- ── 6. Nightly job: formalise expired trials as read_only ────────────────────
-- Correctness doesn't depend on this (business_is_writable already treats an
-- elapsed trial as read-only); it just moves the stored status so queries and
-- the UI read a clean 'read_only'. pg_cron is already installed (migration 0044).
CREATE OR REPLACE FUNCTION public.expire_trials()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE subscriptions
    SET status = 'read_only', updated_at = now()
    WHERE status = 'trialing' AND current_period_end < now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM expired;
  RETURN v_count;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('expire-trials');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('expire-trials', '30 2 * * *', $$SELECT public.expire_trials();$$);

-- ── 7. Close the read-only gaps not covered by has_tool_access ────────────────
-- These write paths gate on is_business_member/plan_allows, not has_tool_access,
-- so the chokepoint in §5 doesn't reach them. A read-only business must not
-- invite staff or generate new documents/reports — add the writability check
-- directly. SELECT (viewing existing invites/documents) stays open, and so do
-- business_profiles edits and invite revocation, which a lapsed owner may need.
DROP POLICY IF EXISTS insert_member ON public.invites;
CREATE POLICY insert_member ON public.invites FOR INSERT
  WITH CHECK (
    is_business_member(business_id)
    AND plan_allows(business_id, 'team')
    AND member_slots_available(business_id)
    AND business_is_writable(business_id)
  );

DROP POLICY IF EXISTS insert_member ON public.generated_documents;
CREATE POLICY insert_member ON public.generated_documents FOR INSERT
  WITH CHECK (is_business_member(business_id) AND business_is_writable(business_id));

DROP POLICY IF EXISTS update_member ON public.generated_documents;
CREATE POLICY update_member ON public.generated_documents FOR UPDATE
  USING (is_business_member(business_id) AND business_is_writable(business_id))
  WITH CHECK (is_business_member(business_id) AND business_is_writable(business_id));

-- ── 8. Grants — trigger/cron functions stay off the RPC surface ──────────────
REVOKE EXECUTE ON FUNCTION public.business_is_writable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_is_writable(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_tool_access(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_tool_access(uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_trial_subscription() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_plan_from_subscription() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_trials() FROM PUBLIC, anon, authenticated;
