-- The previous revoke targeted anon/authenticated directly, but the privilege
-- was actually coming from the default PUBLIC grant Postgres applies at
-- function creation. Revoke from PUBLIC to actually lock it down.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
