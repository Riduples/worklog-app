import { describe, expect, it } from "vitest";
import {
  pfEncode,
  signatureString,
  signPairs,
  verifySignature,
  formatAmount,
  buildSubscriptionFields,
  type PayfastConfig,
  type PfPairs,
} from "@/lib/payfast";

// PayFast rejects a payment whose signature it can't reproduce, and the whole
// scheme rests on matching PHP's urlencode byte for byte. These lock the three
// differences from encodeURIComponent that each silently break every signature.
describe("pfEncode (PHP urlencode compatibility)", () => {
  it("encodes a space as +, not %20", () => {
    expect(pfEncode("hello world")).toBe("hello+world");
  });

  it("escapes the characters encodeURIComponent leaves alone", () => {
    expect(pfEncode("!")).toBe("%21");
    expect(pfEncode("'")).toBe("%27");
    expect(pfEncode("(")).toBe("%28");
    expect(pfEncode(")")).toBe("%29");
    expect(pfEncode("*")).toBe("%2A");
    expect(pfEncode("~")).toBe("%7E");
  });

  it("escapes reserved characters with uppercase hex", () => {
    expect(pfEncode("a&b=c")).toBe("a%26b%3Dc");
    expect(pfEncode("R99.00")).toBe("R99.00"); // dots and digits pass through
  });
});

const config: PayfastConfig = {
  mode: "sandbox",
  merchantId: "10000100",
  merchantKey: "46f0cd694581a",
  passphrase: "",
  processUrl: "https://sandbox.payfast.co.za/eng/process",
  validateUrl: "https://sandbox.payfast.co.za/eng/query/validate",
  configured: true,
};

describe("signatureString", () => {
  it("joins non-empty pairs in order, url-encoded", () => {
    const pairs: PfPairs = [["merchant_id", "10000100"], ["item_name", "Worklog Solo — monthly"], ["amount", "99.00"]];
    expect(signatureString(pairs, "")).toBe("merchant_id=10000100&item_name=Worklog+Solo+%E2%80%94+monthly&amount=99.00");
  });

  it("drops empty values and never signs the signature field", () => {
    const pairs: PfPairs = [["merchant_id", "10000100"], ["cell_number", ""], ["signature", "deadbeef"]];
    expect(signatureString(pairs, "")).toBe("merchant_id=10000100");
  });

  it("appends the passphrase last when set", () => {
    const pairs: PfPairs = [["amount", "99.00"]];
    expect(signatureString(pairs, "s3cret")).toBe("amount=99.00&passphrase=s3cret");
  });
});

describe("signPairs", () => {
  it("is a 32-char hex MD5", () => {
    expect(signPairs([["amount", "99.00"]], "")).toMatch(/^[0-9a-f]{32}$/);
  });

  it("changes when the field order changes", () => {
    const a = signPairs([["amount", "99.00"], ["item_name", "Solo"]], "");
    const b = signPairs([["item_name", "Solo"], ["amount", "99.00"]], "");
    expect(a).not.toBe(b);
  });

  it("changes when the passphrase changes — so a wrong passphrase can't validate", () => {
    const withNone = signPairs([["amount", "99.00"]], "");
    const withPass = signPairs([["amount", "99.00"]], "s3cret");
    expect(withNone).not.toBe(withPass);
  });
});

describe("verifySignature", () => {
  const pairs: PfPairs = [["m_payment_id", "abc"], ["amount", "99.00"], ["custom_str2", "solo"]];

  it("accepts a signature it just produced (round trip)", () => {
    const sig = signPairs(pairs, "pf");
    expect(verifySignature(pairs, "pf", sig)).toBe(true);
  });

  it("accepts an upper-cased signature — PayFast's hex casing shouldn't matter", () => {
    const sig = signPairs(pairs, "pf").toUpperCase();
    expect(verifySignature(pairs, "pf", sig)).toBe(true);
  });

  it("rejects a tampered amount", () => {
    const sig = signPairs(pairs, "pf");
    const tampered: PfPairs = [["m_payment_id", "abc"], ["amount", "9.00"], ["custom_str2", "solo"]];
    expect(verifySignature(tampered, "pf", sig)).toBe(false);
  });

  it("rejects the wrong passphrase and junk", () => {
    const sig = signPairs(pairs, "pf");
    expect(verifySignature(pairs, "not-pf", sig)).toBe(false);
    expect(verifySignature(pairs, "pf", "deadbeef")).toBe(false);
  });
});

describe("formatAmount", () => {
  it("always has two decimal places", () => {
    expect(formatAmount(99)).toBe("99.00");
    expect(formatAmount(199)).toBe("199.00");
    expect(formatAmount(50.5)).toBe("50.50");
  });
});

describe("buildSubscriptionFields", () => {
  const fields = buildSubscriptionFields({
    config,
    plan: "structured",
    businessId: "biz-123",
    mPaymentId: "mp-1",
    email: "owner@example.com",
    returnUrl: "https://app/return",
    cancelUrl: "https://app/cancel",
    notifyUrl: "https://app/api/payfast/notify",
  });
  const get = (k: string) => fields.find(([key]) => key === k)?.[1];

  it("prices the plan from the shared source and formats it", () => {
    expect(get("amount")).toBe("229.00"); // PLAN_PRICE_ZAR.structured
    expect(get("recurring_amount")).toBe("229.00");
  });

  it("carries the business and plan for the ITN, and sets up a monthly recurring subscription", () => {
    expect(get("custom_str1")).toBe("biz-123");
    expect(get("custom_str2")).toBe("structured");
    expect(get("subscription_type")).toBe("1");
    expect(get("frequency")).toBe("3"); // monthly
    expect(get("cycles")).toBe("0"); // until cancelled
  });

  it("appends a signature that validates against the same fields", () => {
    const sig = get("signature")!;
    expect(sig).toMatch(/^[0-9a-f]{32}$/);
    const withoutSig = fields.filter(([k]) => k !== "signature");
    expect(verifySignature(withoutSig, config.passphrase, sig)).toBe(true);
  });
});
