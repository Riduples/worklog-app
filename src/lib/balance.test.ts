import { describe, expect, it } from "vitest";
import { balanceInclVat } from "./balance";
import { fmt } from "./format";
import { buildInvoiceText } from "./docgen/shareText";
import { buildDocumentHTML, type DocForRender } from "./docgen/buildDocumentHTML";
import type { Invoice } from "@/lib/supabase/hooks/useInvoices";
import type { BusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";

// Expectations are built with fmt() rather than typed out. South African money
// is "R 1 150,00" — a non-breaking space for thousands and a comma for the
// decimal — and hand-writing that gets you a test that fails on the separator
// instead of the arithmetic. These tests are about the balance rule; the
// formatter is taxRates' business.

// The shape marking-paid leaves behind: balance_due zeroed, vat_amount kept as
// the snapshot of what was charged. Every bug here was `balance + vat` on that.
const PAID = { balance_due: 0, vat_amount: 150 };
const UNPAID = { balance_due: 1000, vat_amount: 150 };

describe("balanceInclVat", () => {
  it("adds VAT to what is still owed", () => {
    expect(balanceInclVat(UNPAID.balance_due, UNPAID.vat_amount)).toBe(1150);
  });

  it("owes nothing once the balance is cleared — VAT included", () => {
    expect(balanceInclVat(PAID.balance_due, PAID.vat_amount)).toBe(0);
  });

  it("handles a document with no VAT", () => {
    expect(balanceInclVat(500, null)).toBe(500);
    expect(balanceInclVat(500, undefined)).toBe(500);
  });

  it("copes with the strings Postgres NUMERIC comes back as", () => {
    expect(balanceInclVat("1000.00", "150.00")).toBe(1150);
    expect(balanceInclVat("0.00", "150.00")).toBe(0);
  });

  it("treats a missing balance as nothing owed rather than NaN", () => {
    expect(balanceInclVat(null, 150)).toBe(0);
    expect(balanceInclVat(undefined, 150)).toBe(0);
  });

  it("never returns a negative balance as a VAT-inflated one", () => {
    // An overpayment shouldn't turn into "you owe the VAT".
    expect(balanceInclVat(-50, 150)).toBe(0);
  });
});

const invoice = (over: Partial<Invoice> = {}) =>
  ({
    doc_number: "INV-2026-0001",
    client_name: "Sarah Dlamini",
    issue_date: "2026-07-16",
    due_date: "2026-08-15",
    invoice_amount: 1000,
    vat_amount: 150,
    balance_due: 1000,
    deposit_received: 0,
    status: "unpaid",
    ...over,
  }) as Invoice;

describe("the WhatsApp text a customer actually receives", () => {
  it("asks for the balance including VAT while it is unpaid", () => {
    expect(buildInvoiceText(invoice())).toContain(`*BALANCE DUE: ${fmt(1150)}*`);
  });

  it("does not chase a paid invoice for its VAT", () => {
    // The one that reached customers: the same modal showed R 0,00 on screen
    // and sent a message demanding the VAT.
    const text = buildInvoiceText(invoice({ status: "paid", balance_due: 0 }));
    expect(text).toContain(`*BALANCE DUE: ${fmt(0)}*`);
    expect(text).not.toContain(`BALANCE DUE: ${fmt(150)}`);
  });
});

const business = () =>
  ({ name: "Thabo's Plumbing", phone: "082 123 4567", vat_number: "4123456789" }) as BusinessProfile;

const doc = (over: Partial<DocForRender> = {}): DocForRender => ({
  doc_number: "INV-2026-0001",
  issue_date: "2026-07-16",
  recipient_name: "Sarah Dlamini",
  line_items: [{ desc: "Geyser install", qty: 1, labour: 1000, materials: 0 }],
  subtotal: 1000,
  vat_rate: 0.15,
  vat_amount: 150,
  deposit: 0,
  balance_due: 1000,
  due_date: "2026-08-15",
  ...over,
});

// The rendered "Total Due" line, isolated from the VAT breakdown above it —
// which legitimately prints the VAT figure and would otherwise match.
const dueLine = (html: string) => html.match(/(?:Total|Balance) Due[^<]*<\/span>\s*<span>([^<]*)<\/span>/)?.[1] ?? "(no due line found)";

describe("the PDF a customer actually receives", () => {
  it("shows the balance including VAT while it is unpaid", () => {
    expect(dueLine(buildDocumentHTML(doc(), business(), "invoice"))).toBe(fmt(1150));
  });

  it("shows nothing due on a paid invoice", () => {
    // buildDocumentHTML.test.ts only ever passed balance_due: 2000, so the zero
    // case — the one that was wrong — was never rendered in a test.
    expect(dueLine(buildDocumentHTML(doc({ balance_due: 0 }), business(), "invoice"))).toBe(fmt(0));
  });

  it("still falls back to the subtotal when no balance was recorded", () => {
    // Not part-paid, so the whole thing is due. The guard must not swallow this.
    const html = buildDocumentHTML(doc({ balance_due: null as unknown as number }), business(), "invoice");
    expect(dueLine(html)).toBe(fmt(1150));
  });
});
