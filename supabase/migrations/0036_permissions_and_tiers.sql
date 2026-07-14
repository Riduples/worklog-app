-- Permissions + Tiers (v2 Phase 10). Adds the manual subscription-tier flag
-- to business_profiles, and two owner-gated RPCs: one to change a non-owner
-- member's per-tool permissions, one to change the business's plan. Neither
-- touches billing — "plan" is just a flag per the product decision to defer
-- real payment-processor integration.

ALTER TABLE business_profiles
  ADD COLUMN plan text NOT NULL DEFAULT 'shoebox' CHECK (plan IN ('shoebox', 'solo', 'business'));

-- ── update_member_permissions ───────────────────────────────────────────────
-- Only an owner of the same business may change another member's permissions.
-- Owners themselves always have full access (see getAccess() client-side), so
-- their own row's permissions are never edited via this path.
CREATE FUNCTION update_member_permissions(target_member_id uuid, new_permissions jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_business_id uuid;
BEGIN
  SELECT business_id INTO v_business_id FROM business_members WHERE id = target_member_id;
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM business_members
    WHERE business_id = v_business_id AND user_id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only an owner can change permissions';
  END IF;

  UPDATE business_members
  SET permissions = new_permissions, updated_at = now()
  WHERE id = target_member_id AND role != 'owner';
END;
$$;
REVOKE EXECUTE ON FUNCTION update_member_permissions(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_member_permissions(uuid, jsonb) TO authenticated;

-- ── update_business_plan ─────────────────────────────────────────────────────
-- Only an owner may change the manual plan flag.
CREATE FUNCTION update_business_plan(target_business_id uuid, new_plan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
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

  UPDATE business_profiles SET plan = new_plan, updated_at = now() WHERE id = target_business_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION update_business_plan(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_business_plan(uuid, text) TO authenticated;
