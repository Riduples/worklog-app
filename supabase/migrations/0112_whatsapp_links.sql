-- WhatsApp bot — Phase 0 identity table.
--
-- Maps a WhatsApp number to a business so the inbound webhook — which has NO
-- session (Meta calls it server-to-server, like /api/payfast/notify) — can
-- resolve who is messaging and scope every read/write to that business. One
-- linked number per business for v1.
--
-- Two lifecycle states live in the one row:
--   • pending  — the owner generated a link_code in the app but the number
--                hasn't confirmed yet (phone_e164 + verified_at are NULL).
--   • linked   — the number sent that code to the bot; the webhook set
--                phone_e164 + verified_at and cleared the code.
--
-- The webhook writes here with the service-role client (which bypasses RLS), so
-- the policies below only govern the in-app opt-in path (the logged-in owner).
-- On the webhook path, tenant isolation is the route's job, per-query — exactly
-- as /api/payfast/notify threads its business_id — there is no RLS safety net
-- once the service role is used.

CREATE TABLE whatsapp_links (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  -- Who linked the number. Phase 1 attributes WhatsApp-logged rows to this user.
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The linked WhatsApp number as Meta reports the sender: a wa_id — digits,
  -- country code, no '+' (e.g. '27821234567'). NULL until the code is confirmed.
  -- UNIQUE so one number can never be linked to two businesses at once.
  phone_e164            text UNIQUE,
  -- The 6-digit opt-in code the owner shows in-app and sends to the bot. NULL
  -- once confirmed (or never generated).
  link_code             text,
  link_code_expires_at  timestamptz,
  verified_at           timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  -- One WhatsApp link per business for v1.
  UNIQUE (business_id)
);

-- The webhook looks a pending row up by its code; index that lookup. Partial —
-- only pending rows carry a code.
CREATE INDEX idx_whatsapp_links_link_code ON whatsapp_links (link_code) WHERE link_code IS NOT NULL;

ALTER TABLE whatsapp_links ENABLE ROW LEVEL SECURITY;

-- In-app opt-in path only (the webhook uses the service role and bypasses RLS).
-- Same membership helper every business-scoped table uses (migration 0029).
CREATE POLICY "select_member" ON whatsapp_links FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "insert_member" ON whatsapp_links FOR INSERT WITH CHECK (is_business_member(business_id));
CREATE POLICY "update_member" ON whatsapp_links FOR UPDATE USING (is_business_member(business_id)) WITH CHECK (is_business_member(business_id));
CREATE POLICY "delete_member" ON whatsapp_links FOR DELETE USING (is_business_member(business_id));
