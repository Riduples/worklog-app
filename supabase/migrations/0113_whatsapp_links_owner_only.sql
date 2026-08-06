-- WhatsApp links: tighten RLS from member-level to OWNER-only.
--
-- 0112 gave whatsapp_links the same is_business_member() policies every
-- business-scoped table uses. But "Connect WhatsApp" is an owner-only feature
-- (the Business Hub page and /api/whatsapp/connect both gate on
-- business_profiles.user_id), and RLS is the ONLY backstop for a member who
-- calls PostgREST directly with their own JWT. Member-level policies would let
-- a non-owner read the owner's pending link_code, self-link their number
-- without the code handshake, overwrite the owner's linked number, or delete
-- the link. Gate the whole table to the owner instead — Postgres has no
-- column-level RLS, and nothing here should be member-readable.

-- Owner = the business_profiles.user_id, exactly as the route checks. SECURITY
-- DEFINER so it can read business_profiles regardless of the caller's own RLS,
-- mirroring is_business_member (migration 0029).
CREATE FUNCTION is_business_owner(target_business_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_profiles
    WHERE id = target_business_id AND user_id = (SELECT auth.uid())
  );
$$;
REVOKE EXECUTE ON FUNCTION is_business_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_business_owner(uuid) TO authenticated;

DROP POLICY "select_member" ON whatsapp_links;
DROP POLICY "insert_member" ON whatsapp_links;
DROP POLICY "update_member" ON whatsapp_links;
DROP POLICY "delete_member" ON whatsapp_links;

CREATE POLICY "select_owner" ON whatsapp_links FOR SELECT USING (is_business_owner(business_id));
CREATE POLICY "insert_owner" ON whatsapp_links FOR INSERT WITH CHECK (is_business_owner(business_id));
CREATE POLICY "update_owner" ON whatsapp_links FOR UPDATE USING (is_business_owner(business_id)) WITH CHECK (is_business_owner(business_id));
CREATE POLICY "delete_owner" ON whatsapp_links FOR DELETE USING (is_business_owner(business_id));
