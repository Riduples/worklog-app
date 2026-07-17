-- Billing schema, and the lock that makes tier enforcement mean something.
--
-- 0052 gated every plan-locked write on business_profiles.plan. That was
-- necessary but toothless: update_business_plan() only checked that the caller
-- was an OWNER, never that they had paid. An ordinary signed-in owner could
-- call it from the browser and promote themselves to Business for free, which
-- unlocked everything 0052 had just gated. Verified before writing this.
--
-- From worklog-schema.sql (subscriptions + payment_events), adapted to our
-- table names.
--
-- (0055 immediately follows: this version still lets a downgrade bypass a live
-- subscription, which is the same drift by the side door.)

-- worklog-schema.sql assumes this helper; our schema never had it (tables set
-- updated_at from the client). Subscriptions are written by a webhook, where
-- there is no client to trust with a timestamp.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  tier               text NOT NULL DEFAULT 'shoebox',
  status             text NOT NULL DEFAULT 'active',
  payfast_token      text,
  current_period_end timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_tier_check   CHECK (tier IN ('shoebox','solo','business')),
  CONSTRAINT subscriptions_status_check CHECK (status IN ('active','past_due','cancelled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subs_business ON subscriptions(business_id);

-- One row per PayFast ITN, written before the ITN is acted on. If money moved
-- and the plan didn't, or the plan moved and no money did, this is where the
-- answer is. raw_payload is kept verbatim -- never re-derived.
CREATE TABLE IF NOT EXISTS payment_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE,
  business_id     uuid REFERENCES business_profiles(id) ON DELETE SET NULL,
  event_type      text,
  raw_payload     jsonb,
  signature_valid boolean,
  source_ip       text,
  processed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_events_business ON payment_events(business_id, processed_at DESC);

ALTER TABLE subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

-- Read-only to the business. Nothing signed in may write either table: the ITN
-- handler uses the service role, which bypasses RLS. A client that could write
-- its own subscription could grant itself a plan, which is the whole bug.
DROP POLICY IF EXISTS select_member ON subscriptions;
CREATE POLICY select_member ON subscriptions FOR SELECT USING (is_business_member(business_id));

-- payment_events carries raw gateway payloads. Not exposed to the client at
-- all -- it is an audit trail for us, and there is no screen that needs it.
-- No policy = no access for anon/authenticated; the service role still reaches it.

-- business_profiles.plan stays the single thing the app enforces (plan_allows,
-- isLocked and every call site already read it). subscriptions.tier is what
-- was actually paid for. Two fields that must agree is exactly the drift that
-- caused the P&L and SDL bugs -- so plan is SYNCED FROM subscriptions by
-- trigger rather than being set alongside it. Once billing is live, payment
-- drives the plan and cannot silently disagree with it.
CREATE OR REPLACE FUNCTION public.sync_plan_from_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE business_profiles
  SET plan = CASE
        -- past_due keeps the tier: PayFast retries, and cutting someone off
        -- mid-retry over a bank glitch loses a customer to fix nothing.
        WHEN NEW.status IN ('active', 'past_due') THEN NEW.tier
        ELSE 'shoebox'
      END,
      updated_at = now()
  WHERE id = NEW.business_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_subscriptions_sync_plan ON subscriptions;
CREATE TRIGGER t_subscriptions_sync_plan
  AFTER INSERT OR UPDATE OF tier, status ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_plan_from_subscription();

DROP TRIGGER IF EXISTS t_subscriptions_updated ON subscriptions;
CREATE TRIGGER t_subscriptions_updated
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The admin override. Deliberately a table and not a role check or an email
-- pattern: who can grant a paid plan for free should be an explicit, auditable
-- list, not something inferred.
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
-- No policy: unreadable and unwritable by anon/authenticated. Only
-- SECURITY DEFINER functions and the service role see it, so a user cannot
-- discover who the admins are, let alone add themselves.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.plan_rank(p_plan text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(array_position(ARRAY['shoebox','solo','business']::text[], p_plan), 1);
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.plan_rank(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.plan_rank(text) TO authenticated;

-- Downgrading stays self-service: it costs us nothing and refusing it would be
-- hostile. Upgrading now requires either a verified payment (the ITN writes
-- subscriptions, and the trigger above moves the plan) or an explicit admin.
CREATE OR REPLACE FUNCTION public.update_business_plan(target_business_id uuid, new_plan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  current_plan text;
BEGIN
  IF new_plan NOT IN ('shoebox', 'solo', 'business') THEN
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

REVOKE EXECUTE ON FUNCTION public.update_business_plan(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_business_plan(uuid, text) TO authenticated;

-- The founder accounts, so an upgrade path exists for testing and comps before
-- (and after) PayFast. Explicit rows, not an inferred rule.
INSERT INTO platform_admins (user_id, note)
SELECT u.id, 'Founder — ' || u.email
FROM auth.users u
WHERE u.email IN ('riaan.personal@gmail.com', 'hello@worklog.co.za')
ON CONFLICT (user_id) DO NOTHING;
