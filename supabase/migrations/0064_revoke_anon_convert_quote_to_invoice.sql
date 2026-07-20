-- Take convert_quote_to_invoice off anon's callable surface (security review).
--
-- It's SECURITY INVOKER, so RLS already stops an anonymous caller from reading
-- the quote or inserting the invoice — calling it would just error. But an
-- authenticated-only operation has no business sitting in the anon RPC list.
--
-- Revoke from PUBLIC *and* anon, then re-grant authenticated. Both are needed
-- and staging proved why: a fresh project carries only the default PUBLIC grant
-- (revoking PUBLIC is enough there), but the older prod project also has a
-- direct anon grant from Supabase's default privileges, which a PUBLIC-only
-- revoke leaves untouched. Revoking anon directly on its own is the opposite
-- trap 0028 documented. Belt and braces covers both; this is the same
-- FROM PUBLIC, anon form every other hardened function in this repo uses.
REVOKE EXECUTE ON FUNCTION
  public.convert_quote_to_invoice(uuid, text, jsonb, numeric, numeric, numeric, numeric, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.convert_quote_to_invoice(uuid, text, jsonb, numeric, numeric, numeric, numeric, date, date) TO authenticated;
