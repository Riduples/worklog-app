import { getSendCredentials, graphVersion } from "./config";

const GRAPH_BASE = "https://graph.facebook.com";

function messagesUrl(phoneId: string): string {
  return `${GRAPH_BASE}/${graphVersion()}/${phoneId}/messages`;
}

// Send a plain-text WhatsApp reply via the Cloud API. Best-effort by contract:
// the webhook must not fail a delivery just because a reply couldn't be sent, so
// callers wrap this in try/catch. Throws only when credentials are unset or the
// Graph API rejects the call.
export async function sendText(to: string, body: string): Promise<void> {
  const { token, phoneId } = getSendCredentials();
  const res = await fetch(messagesUrl(phoneId), {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp send failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}

// Send a pre-approved template message — Phase 3 proactive nudges, which go out
// beyond the 24h service window and so can't be free-text. `components` carries
// the variable substitutions Meta's template body expects.
export async function sendTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  components?: unknown[]
): Promise<void> {
  const { token, phoneId } = getSendCredentials();
  const res = await fetch(messagesUrl(phoneId), {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components ? { components } : {}),
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp template send failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}

// Download inbound media (a photo or PDF the user sent) for Phase 1 logging.
// Two hops, both Bearer-authenticated: resolve the media id to a short-lived
// URL, then fetch the bytes. Returns base64 + mime so it drops straight into a
// Claude image/document block, exactly as the in-app Quick Log route builds it.
export async function downloadMedia(mediaId: string): Promise<{ base64: string; mimeType: string }> {
  const { token } = getSendCredentials();
  const metaRes = await fetch(`${GRAPH_BASE}/${graphVersion()}/${mediaId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error(`WhatsApp media lookup failed (${metaRes.status})`);
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) throw new Error("WhatsApp media lookup returned no url");

  const binRes = await fetch(meta.url, { headers: { authorization: `Bearer ${token}` } });
  if (!binRes.ok) throw new Error(`WhatsApp media download failed (${binRes.status})`);
  const buf = Buffer.from(await binRes.arrayBuffer());
  return { base64: buf.toString("base64"), mimeType: meta.mime_type || "application/octet-stream" };
}
