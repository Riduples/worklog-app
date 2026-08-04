-- 0103: add the new "payables" tool (Age Analysis — Suppliers) to plan_allows'
-- Solo lock list, mirroring "ageanalysis" (Age Analysis — Customers). Both are
-- Trade+ features (see tiers.ts TRADE_PLUS); this keeps the DB plan gate in step
-- with the app. Defence-in-depth only: age analysis is a read-only report with
-- no table, so no RLS policy calls plan_allows() for it — the page is already
-- gated app-side by requirePlanAccess. Everything else in the function is
-- preserved exactly from the live definition.
CREATE OR REPLACE FUNCTION public.plan_allows(p_business_id uuid, p_tool text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT CASE
    WHEN p_tool IN ('team', 'invoice_recurring') THEN bp.plan IN ('trade', 'structured')
    WHEN bp.plan = 'structured' THEN true
    WHEN bp.plan = 'trade' THEN p_tool <> ALL (ARRAY['vat201','emp201','provtax','compliance'])
    WHEN bp.plan = 'solo' THEN p_tool <> ALL (ARRAY[
      'staffregister','payrun','advances','leave',
      'purchaseorder','supplierinvoice','remittance','statement','ageanalysis','payables',
      'vat201','emp201','provtax','compliance'
    ])
    ELSE true
  END
  FROM business_profiles bp
  WHERE bp.id = p_business_id;
$function$;
