-- Multi-tenant foundation (v2 Phase 10, prerequisite for teams/permissions/tiers/payroll).
-- business_profiles becomes the tenant root itself (it already has exactly the
-- right shape: name/address/vat_number etc., one row per business). We add a
-- business_members join table for membership + role, and an invites table for
-- a real token-based invite flow (schema only in this pass — send/accept UI
-- is a separate follow-up).
--
-- Every existing user_id-scoped table gets a business_id column, backfilled
-- from the user's own business_profiles row, then RLS is migrated from
-- "user_id = auth.uid()" to "is_business_member(business_id)". worker_payments
-- and chair_rentals are deliberately left untouched — they're already
-- deprecated and will be dropped/replaced by the payroll rebuild.

-- ── business_members ────────────────────────────────────────────────────────
CREATE TABLE business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (business_id, user_id)
);
CREATE INDEX idx_business_members_user ON business_members(user_id);
CREATE INDEX idx_business_members_business ON business_members(business_id);

-- ── invites ──────────────────────────────────────────────────────────────────
CREATE TABLE invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_invites_business ON invites(business_id);
CREATE INDEX idx_invites_token ON invites(token);

-- ── membership helper (SECURITY DEFINER avoids RLS self-recursion on
--    business_members, and is reused by every other table's policies) ───────
CREATE FUNCTION is_business_member(target_business_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_members
    WHERE business_id = target_business_id AND user_id = (SELECT auth.uid())
  );
$$;
REVOKE EXECUTE ON FUNCTION is_business_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_business_member(uuid) TO authenticated;

-- ── auto-create owner membership whenever a business_profiles row is made ──
CREATE FUNCTION create_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO business_members (business_id, user_id, role, permissions)
  VALUES (NEW.id, NEW.user_id, 'owner', '{"all": "full"}'::jsonb);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION create_owner_membership() FROM PUBLIC;

CREATE TRIGGER trg_create_owner_membership
AFTER INSERT ON business_profiles
FOR EACH ROW EXECUTE FUNCTION create_owner_membership();

-- Backfill: every existing business_profiles row's creator becomes its owner.
INSERT INTO business_members (business_id, user_id, role, permissions)
SELECT id, user_id, 'owner', '{"all": "full"}'::jsonb FROM business_profiles;

-- ── business_profiles / business_members RLS ────────────────────────────────
DROP POLICY IF EXISTS "select_own" ON business_profiles;
DROP POLICY IF EXISTS "insert_own" ON business_profiles;
DROP POLICY IF EXISTS "update_own" ON business_profiles;

CREATE POLICY "select_member" ON business_profiles FOR SELECT USING (is_business_member(id));
CREATE POLICY "insert_own" ON business_profiles FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "update_owner" ON business_profiles FOR UPDATE USING (is_business_member(id)) WITH CHECK (is_business_member(id));

ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_member" ON business_members FOR SELECT USING (is_business_member(business_id));

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_member" ON invites FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "insert_member" ON invites FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "delete_member" ON invites FOR DELETE USING (is_business_member(business_id));
