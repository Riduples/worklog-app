import crypto from "crypto";

// Meta signs every inbound webhook POST with an HMAC-SHA256 of the RAW request
// body under the app secret, sent as `X-Hub-Signature-256: sha256=<hex>`.
// Recompute it over the exact bytes we received — parse the JSON only AFTER this
// passes — and compare in constant time. A missing or mismatched signature
// means the request did not come from Meta, and nothing downstream should run.
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  appSecret: string
): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return timingSafeEqualStr(header, expected);
}

// Constant-time string equality. timingSafeEqual throws on length mismatch, so
// guard first — a wrong-length input is a clean `false`, not an exception (and
// leaking the length of a secret this way is not a concern here). Used for both
// the signature and the GET verify-token comparison so neither leaks via timing.
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
