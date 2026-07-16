-- Per-tool permission check for RLS.
--
-- is_business_member() only proves tenancy: any member of a business could
-- write anything belonging to it, regardless of the access level the owner
-- granted them. The permissions map was enforced nowhere -- not in the client
-- (canEdit had one call site) and not here -- so the "Can see everything"
-- preset, which promises "Can't add, edit, delete or approve anything",
-- did not hold. This is the enforcement point; the client is only a courtesy.
--
-- Levels are ordered off < view < edit < approve < full. Owners are always
-- full, matching getAccess() in src/lib/permissions.ts.
CREATE OR REPLACE FUNCTION public.tool_access_rank(p_level text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(
    array_position(ARRAY['off','view','edit','approve','full']::text[], p_level),
    1  -- unknown/NULL level is treated as 'off', never as access
  );
$$;

CREATE OR REPLACE FUNCTION public.has_tool_access(p_business_id uuid, p_tool text, p_min_level text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
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

-- Supabase's default privileges auto-grant EXECUTE to anon/authenticated, and
-- REVOKE FROM PUBLIC alone does not remove those grants. authenticated must
-- keep EXECUTE (RLS policies run as the caller); anon must not.
--
-- This trips the advisor's "Signed-In Users Can Execute SECURITY DEFINER
-- Function" warning, same as is_business_member. Accepted: the function only
-- reports what the caller may do with their own membership, which they already
-- know, and RLS quals need it callable as the querying role.
REVOKE EXECUTE ON FUNCTION public.has_tool_access(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tool_access_rank(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_tool_access(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tool_access_rank(text) TO authenticated;
