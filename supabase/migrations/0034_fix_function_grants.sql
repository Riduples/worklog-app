-- Supabase's default privileges auto-grant EXECUTE to anon/authenticated on
-- function creation, separate from the PUBLIC grant — revoking from PUBLIC
-- alone (as done for these two functions earlier) doesn't remove that.
--
-- create_owner_membership: trigger-only function. Trigger firing does not
-- require the triggering role to hold EXECUTE on the function (that's a
-- DML/TRIGGER privilege on the table, not an RPC call), so it's safe to
-- revoke from both roles entirely.
REVOKE EXECUTE ON FUNCTION create_owner_membership() FROM anon, authenticated;

-- is_business_member: used inside RLS policy expressions, so `authenticated`
-- must keep EXECUTE (policy evaluation runs as the querying role) — but
-- `anon` never needs it since nothing in this app is reachable unauthenticated.
REVOKE EXECUTE ON FUNCTION is_business_member(uuid) FROM anon;
