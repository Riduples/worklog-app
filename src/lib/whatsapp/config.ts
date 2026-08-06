// WhatsApp Cloud API credentials — central, server-only readers.
//
// None of these is NEXT_PUBLIC_; none may reach a browser bundle. They're set
// in Vercel Project Settings once the WhatsApp Business number is registered on
// the Meta Cloud API. Each path reads ONLY what it needs (verify token for the
// GET handshake, app secret for signature checks, token + phone id for sends),
// so a partly-configured setup during Meta onboarding still lets the pieces
// that are ready work, and the rest fail closed on their own missing var.

// Pinned but overridable, so Meta deprecating a version is an env change, not a
// code change. Graph versions look like "v21.0".
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";

export function graphVersion(): string {
  return GRAPH_VERSION;
}

/** The token Meta echoes back on the GET webhook-verification handshake. */
export function getVerifyToken(): string {
  const t = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!t) throw new Error("WhatsApp is not configured (WHATSAPP_VERIFY_TOKEN)");
  return t;
}

/** The Meta app secret — signs every inbound POST (X-Hub-Signature-256). */
export function getAppSecret(): string {
  const s = process.env.WHATSAPP_APP_SECRET;
  if (!s) throw new Error("WhatsApp is not configured (WHATSAPP_APP_SECRET)");
  return s;
}

/** The Cloud API access token + registered phone-number id, for send + media. */
export function getSendCredentials(): { token: string; phoneId: string } {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    throw new Error("WhatsApp is not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID)");
  }
  return { token, phoneId };
}
