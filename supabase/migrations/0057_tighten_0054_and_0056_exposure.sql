-- Two things the advisors caught in my own work from 0054 and 0056.
--
-- 1. sync_plan_from_subscription() was reachable over the REST API by anon and
--    authenticated. It is a TRIGGER function: it only makes sense with a NEW
--    row, and Postgres runs it as the table owner regardless of who is granted
--    EXECUTE. Being callable at /rest/v1/rpc/ buys nothing and exposes a
--    SECURITY DEFINER function whose whole job is moving a business's plan.
--    Supabase's default privileges auto-grant EXECUTE to anon/authenticated on
--    creation, which is exactly how this slipped in — the same default that has
--    caught this project before.
REVOKE EXECUTE ON FUNCTION public.sync_plan_from_subscription() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- 2. The business-logos bucket is public, and a broad SELECT policy on
--    storage.objects let anyone LIST it — enumerating every business's logo
--    path, and with it every business_id. A public bucket serves its object
--    URLs without any SELECT policy at all, so the policy was pure exposure
--    for zero function. Reading a logo by its URL still works.
DROP POLICY IF EXISTS "business logos are readable by anyone" ON storage.objects;
