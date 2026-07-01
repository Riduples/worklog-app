-- Trigger execution does not require EXECUTE grants; revoking API-facing
-- EXECUTE closes the /rest/v1/rpc/handle_new_user public/authenticated exposure
-- flagged by the security advisor without affecting the auth.users trigger.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
