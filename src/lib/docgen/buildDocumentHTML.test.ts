import { describe, expect, it } from "vitest";
import { buildDocumentHTML, type DocForRender, type DocKind } from "./buildDocumentHTML";
import type { BusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";

// Only the fields the template reads; the rest of BusinessProfile is irrelevant
// here and stubbing it whole would just be noise.
const business = (over: Partial<BusinessProfile> = {}) =>
  ({
    name: "Thabo's Plumbing",
    address: "1 Main Rd",
    phone: "082 123 4567",
    email: "thabo@example.co.za",
    vat_number: null,
    bank_name: "FNB",
    bank_account: "62812345678",
    bank_branch: "250655",
    bank_ref: "THABO",
    ...over,
  }) as BusinessProfile;

const doc: DocForRender = {
  doc_number: "INV-2026-0001",
  issue_date: "2026-07-16",
  recipient_name: "Sarah Dlamini",
  line_items: [{ desc: "Geyser install", qty: 1, labour: 2000, materials: 0 }],
  subtotal: 2000,
  vat_rate: null,
  vat_amount: 0,
  deposit: 0,
  balance_due: 2000,
  due_date: "2026-08-15",
};

const build = (kind: DocKind, over: Partial<BusinessProfile> = {}) => buildDocumentHTML(doc, business(over), kind);

describe("payment details block", () => {
  it("tells an invoice's reader where to send the money", () => {
    const html = build("invoice");
    expect(html).toContain("Payment details");
    expect(html).toContain("FNB");
    expect(html).toContain("62812345678");
    expect(html).toContain("250655");
  });

  it("shows on a quote too — a deposit has to be payable", () => {
    expect(build("quote")).toContain("Payment details");
  });

  it("stays off a purchase order, where the business is the buyer", () => {
    // Printing your own account number for every supplier serves no purpose
    // and needlessly spreads it around.
    expect(build("purchaseorder")).not.toContain("Payment details");
  });

  it("stays off a payslip", () => {
    expect(build("payslip")).not.toContain("Payment details");
  });

  it("is omitted entirely when no banking is captured", () => {
    // A bank name with no account number tells the customer nothing, so both
    // are required before the block is worth printing.
    expect(build("invoice", { bank_name: null, bank_account: null })).not.toContain("Payment details");
    expect(build("invoice", { bank_name: "FNB", bank_account: null })).not.toContain("Payment details");
    expect(build("invoice", { bank_name: null, bank_account: "62812345678" })).not.toContain("Payment details");
  });

  it("omits the branch row when there's no branch code, but keeps the rest", () => {
    const html = build("invoice", { bank_branch: null });
    expect(html).toContain("Payment details");
    expect(html).not.toContain("Branch code");
  });
});

describe("payment reference", () => {
  it("combines the business reference with the document number", () => {
    expect(build("invoice")).toContain("THABO / INV-2026-0001");
  });

  it("falls back to the document number alone", () => {
    // Unlike the prototype, which dropped the reference row entirely without a
    // bank_ref. An unreferenced EFT is the classic reason a small business
    // can't tell who paid them, so there is always something to quote.
    const html = build("invoice", { bank_ref: null });
    expect(html).toContain("Reference");
    expect(html).toContain("INV-2026-0001");
  });
});

describe("escaping", () => {
  // openDocumentForPrinting() hands this markup to win.document.write(), which
  // executes scripts. A member with edit rights on Contacts could otherwise
  // store a payload that runs when the owner prints.
  const payload = "<script>alert(1)</script>";

  it("escapes a hostile business name", () => {
    const html = buildDocumentHTML(doc, business({ name: payload }), "invoice");
    expect(html).not.toContain(payload);
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes a hostile recipient name", () => {
    const html = buildDocumentHTML({ ...doc, recipient_name: payload }, business(), "invoice");
    expect(html).not.toContain(payload);
  });

  it("escapes a hostile line-item description", () => {
    const html = buildDocumentHTML({ ...doc, line_items: [{ desc: payload, qty: 1, labour: 1 }] }, business(), "invoice");
    expect(html).not.toContain(payload);
  });

  it("escapes hostile banking fields", () => {
    const html = buildDocumentHTML(doc, business({ bank_ref: payload }), "invoice");
    expect(html).not.toContain(payload);
  });

  it("still renders the real value, just inert", () => {
    const html = buildDocumentHTML(doc, business({ name: "Bob & Sons <Pty> Ltd" }), "invoice");
    expect(html).toContain("Bob &amp; Sons &lt;Pty&gt; Ltd");
  });
});
