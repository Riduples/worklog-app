import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSecret, getVerifyToken } from "@/lib/whatsapp/config";
import { timingSafeEqualStr, verifyWebhookSignature } from "@/lib/whatsapp/verify";
import { extractLinkCode, normalizeWaId } from "@/lib/whatsapp/identity";
import { sendText } from "@/lib/whatsapp/send";
import type { WhatsAppInboundMessage, WhatsAppWebhookBody } from "@/lib/whatsapp/types";

export const runtime = "nodejs";

// The WhatsApp Cloud API webhook. Meta calls this server-to-server, so — like
// /api/payfast/notify — it has no session and trusts nothing it isn't forced
// to: it sits on the public allowlist in middleware, and it enforces its own
// auth (Meta's X-Hub-Signature-256 over the raw body). It is the ONLY inbound
// path, and the service-role client it uses bypasses RLS, so every query is
// scoped to the business resolved from the sender's *number* — never to
// anything carried in the message.
//
// Phase 0 scope: verify the webhook and run the opt-in handshake. A number that
// sends its code gets linked; a number already linked gets an ack; an unknown
// number is told to connect in the app. Parsing + saving a log is Phase 1.
//
// PHASE 1 PREREQUISITE: add a per-sender-number attempt throttle before wiring
// financial writes to this identity. Today the 8-digit code + short TTL make
// blind redemption impractical, but there is no attempt cap — a throttle is the
// belt-and-braces control once a linked number can post real records.

type Admin = ReturnType<typeof createAdminClient>;

// ── GET: Meta's subscription-verification handshake ──────────────────────────
export function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  let verifyToken: string;
  try {
    verifyToken = getVerifyToken();
  } catch {
    return new NextResponse("not configured", { status: 503 });
  }
  if (mode === "subscribe" && challenge && token !== null && timingSafeEqualStr(token, verifyToken)) {
    return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new NextResponse("forbidden", { status: 403 });
}

// ── POST: inbound messages ───────────────────────────────────────────────────
export async function POST(request: Request) {
  // Read the body raw and FIRST — the signature is over the exact bytes.
  const raw = await request.text();

  let appSecret: string;
  try {
    appSecret = getAppSecret();
  } catch {
    // Not configured yet (Meta setup still in progress). Fail closed, but 503
    // so Meta retries once the secret lands rather than dropping the event.
    return new NextResponse("not configured", { status: 503 });
  }
  if (!verifyWebhookSignature(raw, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let body: WhatsAppWebhookBody | null;
  try {
    body = JSON.parse(raw) as WhatsAppWebhookBody | null;
  } catch {
    return new NextResponse("OK", { status: 200 }); // ack malformed; don't make Meta retry
  }

  // Flatten the batch down to messages (Meta also sends status/receipt events,
  // which we ignore). Optional-chain `body` — a validly-signed body can still
  // JSON-parse to null/a non-object, which must not throw.
  const messages: WhatsAppInboundMessage[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) messages.push(m);
    }
  }
  if (messages.length === 0) return new NextResponse("OK", { status: 200 });

  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    // Service role unset — can't resolve or reply. 503 so Meta retries.
    console.error("[whatsapp/webhook] admin client unavailable —", e instanceof Error ? e.message : e);
    return new NextResponse("service unavailable", { status: 503 });
  }

  // Handle each message. Never throw out of the loop — Meta needs a 200 or it
  // retries the whole batch; a per-message failure is logged and swallowed.
  for (const msg of messages) {
    try {
      await handleMessage(admin, msg);
    } catch (e) {
      console.error("[whatsapp/webhook] message handling failed —", e instanceof Error ? e.message : e);
    }
  }

  return new NextResponse("OK", { status: 200 });
}

async function handleMessage(admin: Admin, msg: WhatsAppInboundMessage): Promise<void> {
  const from = normalizeWaId(msg.from);
  if (!from) return;

  // 1. Already linked? Resolve the business by the sender's number.
  const { data: link } = await admin
    .from("whatsapp_links")
    .select("business_id, verified_at")
    .eq("phone_e164", from)
    .maybeSingle();

  if (link?.verified_at) {
    const name = await businessName(admin, link.business_id);
    // Phase 1 replaces this ack with parse → save. For now, confirm the link.
    await safeSend(
      from,
      `✅ You're connected to ${name}. Logging straight from WhatsApp is coming soon — I'll let you know the moment it's live.`
    );
    return;
  }

  // 2. Not linked — is this the opt-in code?
  const text = msg.type === "text" ? (msg.text?.body ?? "") : "";
  const code = text ? extractLinkCode(text) : null;
  if (code) {
    const result = await tryLinkByCode(admin, code, from);
    if (result.ok) {
      const name = await businessName(admin, result.businessId);
      await safeSend(
        from,
        `✅ Connected! This number is now linked to ${name}. You'll be able to log income and expenses right here soon.`
      );
      return;
    }
    if (result.reason === "expired") {
      await safeSend(from, "⏳ That code has expired. In Worklog, open Business Hub → Connect WhatsApp for a fresh one.");
      return;
    }
    if (result.reason === "taken") {
      await safeSend(
        from,
        "This WhatsApp number is already linked to another Worklog business. Disconnect it there first, then try again."
      );
      return;
    }
    // reason "none": not a real code — fall through to the generic prompt.
  }

  // 3. Unknown number / not a code.
  await safeSend(
    from,
    "👋 Hi! To use Worklog on WhatsApp, open the app → Business Hub → Connect WhatsApp, then send me the code it shows you."
  );
}

type LinkResult = { ok: true; businessId: string } | { ok: false; reason: "none" | "expired" | "taken" };

// Confirm a pending link from its code + the sender's number. Only ever moves a
// row from pending → linked; it can't reassign a business or touch a verified
// row (the WHERE verified_at IS NULL guard), and phone_e164 being UNIQUE means a
// number already linked elsewhere fails as "taken" rather than being hijacked.
async function tryLinkByCode(admin: Admin, code: string, from: string): Promise<LinkResult> {
  // maybeSingle() (not limit(1)) is deliberate: on the astronomically unlikely
  // event that two businesses hold the same pending 8-digit code, this returns
  // an error → no row → "none", so neither is linked to the WRONG business.
  // Both owners just regenerate. Fail-safe beats guessing.
  const { data: pending } = await admin
    .from("whatsapp_links")
    .select("id, link_code_expires_at")
    .eq("link_code", code)
    .is("verified_at", null)
    .maybeSingle();
  if (!pending) return { ok: false, reason: "none" };
  if (!pending.link_code_expires_at || new Date(pending.link_code_expires_at) < new Date()) {
    return { ok: false, reason: "expired" };
  }

  // Guard on verified_at again and read the row back: if it was deleted or
  // verified between the SELECT and here, 0 rows come back and we must NOT
  // report success. The returned business_id is the source of truth.
  const { data: updated, error } = await admin
    .from("whatsapp_links")
    .update({
      phone_e164: from,
      verified_at: new Date().toISOString(),
      link_code: null,
      link_code_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pending.id)
    .is("verified_at", null)
    .select("business_id")
    .maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "23505") return { ok: false, reason: "taken" }; // unique_violation on phone_e164
    throw new Error(error.message);
  }
  if (!updated) return { ok: false, reason: "none" }; // lost a race — nothing was linked
  return { ok: true, businessId: updated.business_id };
}

async function businessName(admin: Admin, businessId: string): Promise<string> {
  const { data } = await admin.from("business_profiles").select("name").eq("id", businessId).maybeSingle();
  return data?.name?.trim() || "your business";
}

async function safeSend(to: string, body: string): Promise<void> {
  try {
    await sendText(to, body);
  } catch (e) {
    console.error("[whatsapp/webhook] reply failed —", e instanceof Error ? e.message : e);
  }
}
