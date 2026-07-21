import crypto from "crypto";
import { PLAN_PRICE_ZAR, TIERS, type Plan } from "@/lib/tiers";

// Server-only. Reads merchant credentials and the passphrase from the
// environment and signs/verifies PayFast requests. Never import this from a
// client component — the passphrase is a secret and the whole point of building
// the signature on the server is that it never reaches the browser.
//
// Sandbox uses PayFast's own published test credentials (merchant 10000100),
// which are not secret and are safe to ship as defaults, so the flow is fully
// testable before a real merchant account exists. Going live is a matter of
// setting PAYFAST_MODE=live and the real PAYFAST_MERCHANT_ID / _KEY / _PASSPHRASE
// in the host environment — nothing in code changes.

export type PayfastMode = "sandbox" | "live";

export type PayfastConfig = {
  mode: PayfastMode;
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  processUrl: string;
  validateUrl: string;
  /** True when we have credentials to actually take a payment. */
  configured: boolean;
};

export function payfastConfig(): PayfastConfig {
  const mode: PayfastMode = process.env.PAYFAST_MODE === "live" ? "live" : "sandbox";
  // Public sandbox test credentials as the fallback — safe, not secret.
  const merchantId = process.env.PAYFAST_MERCHANT_ID || (mode === "sandbox" ? "10000100" : "");
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY || (mode === "sandbox" ? "46f0cd694581a" : "");
  const passphrase = process.env.PAYFAST_PASSPHRASE ?? "";
  const base = mode === "sandbox" ? "https://sandbox.payfast.co.za" : "https://www.payfast.co.za";
  return {
    mode,
    merchantId,
    merchantKey,
    passphrase,
    processUrl: `${base}/eng/process`,
    validateUrl: `${base}/eng/query/validate`,
    configured: Boolean(merchantId && merchantKey),
  };
}

/**
 * URL-encode a value the way PHP's urlencode does, because that is what PayFast
 * signs against. encodeURIComponent differs in three ways that each break the
 * signature: it leaves ! ' ( ) * ~ unescaped, and it encodes a space as %20
 * rather than +. Getting any one of these wrong makes every signature wrong.
 */
export function pfEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

/** Ordered name/value pairs. Order is part of the signature — never a plain object. */
export type PfPairs = Array<[string, string]>;

/**
 * The exact string PayFast hashes: each non-empty pair as key=urlencoded(value),
 * joined by &, in the given order, with the passphrase appended last when set.
 * The signature field itself is never included. Values are trimmed, as PayFast
 * does, so a trailing space in a name can't shift the hash.
 */
export function signatureString(pairs: PfPairs, passphrase: string): string {
  const parts = pairs
    .filter(([k, v]) => k !== "signature" && v !== "" && v != null)
    .map(([k, v]) => `${k}=${pfEncode(String(v).trim())}`);
  if (passphrase) parts.push(`passphrase=${pfEncode(passphrase.trim())}`);
  return parts.join("&");
}

export function signPairs(pairs: PfPairs, passphrase: string): string {
  return crypto.createHash("md5").update(signatureString(pairs, passphrase)).digest("hex");
}

/**
 * Verify a signature PayFast sent us (on an ITN). Rebuilds the hash from the
 * received pairs — in the order received, which is why the caller must preserve
 * it — and compares in constant time so a mismatch can't be timed out byte by
 * byte.
 */
export function verifySignature(pairs: PfPairs, passphrase: string, provided: string): boolean {
  const expected = signPairs(pairs, passphrase);
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided.toLowerCase()));
}

/** The amount PayFast wants: a plain decimal string with exactly two places. */
export function formatAmount(zar: number): string {
  return zar.toFixed(2);
}

/**
 * Build the signed set of fields for a monthly subscription to `plan`, ready to
 * render as a form that POSTs to config.processUrl. The order here is the order
 * PayFast documents for the process page and the order the signature is built
 * in; the signature is appended last. business_id and plan travel in custom_str
 * fields so the ITN can tell whose subscription this is and what they bought —
 * but the ITN still checks the amount against the plan before trusting either.
 */
export function buildSubscriptionFields(opts: {
  config: PayfastConfig;
  plan: Plan;
  businessId: string;
  mPaymentId: string;
  email: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}): PfPairs {
  const amount = formatAmount(PLAN_PRICE_ZAR[opts.plan]);
  const pairs: PfPairs = [
    ["merchant_id", opts.config.merchantId],
    ["merchant_key", opts.config.merchantKey],
    ["return_url", opts.returnUrl],
    ["cancel_url", opts.cancelUrl],
    ["notify_url", opts.notifyUrl],
    ["email_address", opts.email],
    ["m_payment_id", opts.mPaymentId],
    ["amount", amount],
    ["item_name", `Worklog ${TIERS[opts.plan].label} — monthly`],
    ["custom_str1", opts.businessId],
    ["custom_str2", opts.plan],
    // Recurring monthly subscription, indefinite, first charge today.
    ["subscription_type", "1"],
    ["recurring_amount", amount],
    ["frequency", "3"], // 3 = monthly
    ["cycles", "0"], // 0 = until cancelled
  ];
  pairs.push(["signature", signPairs(pairs, opts.config.passphrase)]);
  return pairs;
}
