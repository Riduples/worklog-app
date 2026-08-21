-- 0128: document the four "RLS on, no policies" tables as server-only by design.
--
-- An external DB review flagged that ai_usage_monthly, api_rate_limits,
-- payment_events and platform_admins have RLS enabled with zero policies. That
-- denies all access to anon/authenticated (fail-closed — not a leak). It was
-- verified in the app code that none of these are read directly by the client:
--   ai_usage_monthly — read via the get_ai_quota() SECURITY DEFINER RPC
--   api_rate_limits  — server-only (consume_rate_limit RPC)
--   payment_events   — written only by the PayFast webhook (service-role)
--   platform_admins  — server-only (is_platform_admin RPC)
-- so the deny-all is correct and intentional. These comments record that, so the
-- empty policy list doesn't read as an oversight to the next reviewer, and so a
-- client policy isn't added without a genuine client read behind it.
COMMENT ON TABLE public.ai_usage_monthly IS
  'Server-only. RLS on with no policies = deny-all to anon/authenticated, intentional. Clients read their quota via the get_ai_quota() SECURITY DEFINER RPC, never this table directly. Do not add a client policy without a real client read.';
COMMENT ON TABLE public.api_rate_limits IS
  'Server-only. RLS on with no policies = deny-all, intentional. Written/read only server-side (consume_rate_limit SECURITY DEFINER RPC). Do not add a client policy.';
COMMENT ON TABLE public.payment_events IS
  'Server-only. RLS on with no policies = deny-all, intentional. Written only by the PayFast ITN webhook (service-role). Do not add a client policy.';
COMMENT ON TABLE public.platform_admins IS
  'Server-only. RLS on with no policies = deny-all, intentional. Read only via the is_platform_admin() SECURITY DEFINER RPC. Do not add a client policy.';
