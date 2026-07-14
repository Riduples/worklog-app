-- Real token-based invite accept flow. Manual-link delivery (no auto-email):
-- the owner shares the /accept-invite?token=... link themselves.

-- Publicly readable preview (even by an unauthenticated invitee) — only ever
-- returns info for the exact token supplied, never enumerable.
CREATE FUNCTION get_invite_preview(p_token uuid)
RETURNS TABLE(business_name text, role text, invite_email text, is_expired boolean, is_accepted boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
  SELECT bp.name, i.role, i.email, (i.expires_at < now()), (i.accepted_at IS NOT NULL)
  FROM invites i
  JOIN business_profiles bp ON bp.id = i.business_id
  WHERE i.token = p_token;
$$;
REVOKE EXECUTE ON FUNCTION get_invite_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_invite_preview(uuid) TO anon, authenticated;

-- Accept: must be signed in, email must match the invite, invite must be
-- pending and unexpired. Creates the membership row and marks it accepted.
CREATE FUNCTION accept_invite(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_invite invites%ROWTYPE;
  v_user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to accept an invite';
  END IF;

  SELECT * INTO v_invite FROM invites WHERE token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite already accepted';
  END IF;
  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email IS NULL OR lower(v_user_email) != lower(v_invite.email) THEN
    RAISE EXCEPTION 'This invite was sent to a different email address';
  END IF;

  INSERT INTO business_members (business_id, user_id, role, permissions)
  VALUES (v_invite.business_id, auth.uid(), v_invite.role, v_invite.permissions)
  ON CONFLICT (business_id, user_id) DO NOTHING;

  UPDATE invites SET accepted_at = now() WHERE token = p_token;

  RETURN v_invite.business_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION accept_invite(uuid) FROM PUBLIC, anon;

-- Team member list needs emails, which authenticated can't read directly from
-- auth.users — SECURITY DEFINER bridges that, gated by membership internally.
CREATE FUNCTION get_business_members(target_business_id uuid)
RETURNS TABLE(id uuid, user_id uuid, email text, role text, permissions jsonb, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
  SELECT bm.id, bm.user_id, u.email, bm.role, bm.permissions, bm.created_at
  FROM business_members bm
  JOIN auth.users u ON u.id = bm.user_id
  WHERE is_business_member(target_business_id) AND bm.business_id = target_business_id
  ORDER BY bm.created_at;
$$;
REVOKE EXECUTE ON FUNCTION get_business_members(uuid) FROM PUBLIC, anon;
