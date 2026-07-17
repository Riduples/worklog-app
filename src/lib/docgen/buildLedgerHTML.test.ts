import { describe, expect, it } from "vitest";
import { buildStatementHTML, buildRemittanceHTML, type StatementLine, type RemittanceLine } from "./buildLedgerHTML";
import type { BusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";

// Only the fields the template reads, same as buildDocumentHTML.test.ts.
const business = (over: Partial<BusinessProfile> = {}) =>
  ({
    name: "Thabo's Plumbing",
    address: "1 Main Rd",
    phone: "082 123 4567",
    email: "thabo@example.co.za",
    vat_number: null,
    logo_url: null,
    ...over,
  }) as BusinessProfile;

const statementLines: StatementLine[] = [
  { date: "2026-07-01", reference: "INV-2026-0001", amount: 2000, balance: 2000, paid: false },
  { date: "2026-06-01", reference: "INV-2026-0002", amount: 1500, balance: 0, paid: true },
];

const remittanceLines: RemittanceLine[] = [
  { date: "2026-07-01", reference: "SUP-914", invoiceAmount: 800, amountPaying: 800 },
];

const statement = (over: Partial<BusinessProfile> = {}, clientName = "Sarah Dlamini") =>
  buildStatementHTML(business(over), clientName, statementLines, { invoiced: 3500, received: 1500, outstanding: 2000 }, "2026-07-17");

const remittance = (over: Partial<BusinessProfile> = {}, supplierName = "Pipe Co") =>
  buildRemittanceHTML(business(over), supplierName, remittanceLines, {
    method: "EFT",
    date: "2026-07-17",
    reference: "PAY-001",
    total: 800,
  });

describe("letterhead", () => {
  // A statement goes from the business to their customer, and a remittance from
  // the business to their supplier. Heading either with our own mark put Worklog's
  // name on their correspondence. buildDocumentHTML was fixed for this; this
  // builder was missed and kept ignoring the business it was handed.
  it("statement is headed by the business, not Worklog", () => {
    const html = statement();
    expect(html).toContain("Thabo&#39;s Plumbing");
    expect(html).not.toContain(">Worklog<");
    expect(html).not.toContain("worklog.co.za</div>");
  });

  it("remittance is headed by the business, not Worklog", () => {
    const html = remittance();
    expect(html).toContain("Thabo&#39;s Plumbing");
    expect(html).not.toContain(">Worklog<");
  });

  it("keeps Worklog's credit in the footer, where attribution belongs", () => {
    expect(statement()).toContain("Generated via Worklog");
    expect(remittance()).toContain("Generated via Worklog");
  });

  it("shows the business's logo when there is one", () => {
    const html = statement({ logo_url: "https://example.test/logo.png" });
    expect(html).toContain('<img src="https://example.test/logo.png"');
  });

  it("falls back to the business's initial, not a Worklog mark", () => {
    const html = statement({ logo_url: null });
    expect(html).not.toContain("<img");
    expect(html).toContain(">T<"); // Thabo's Plumbing
  });

  it("copes with a business that has no name yet", () => {
    expect(statement({ logo_url: null, name: null })).toContain(">W<");
  });
});

describe("escaping", () => {
  // Both builders feed openDocumentForPrinting(), which hands the markup to
  // win.document.write() — that executes scripts, in a same-origin window that
  // can read the session. buildDocumentHTML escaped; this one did not escape
  // anything at all, and the client name comes straight from contacts.
  const payload = "<script>alert(1)</script>";

  it("escapes a hostile client name on a statement", () => {
    const html = statement({}, payload);
    expect(html).not.toContain(payload);
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes a hostile supplier name on a remittance", () => {
    const html = remittance({}, payload);
    expect(html).not.toContain(payload);
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes a hostile business name", () => {
    expect(statement({ name: payload })).not.toContain(payload);
    expect(remittance({ name: payload })).not.toContain(payload);
  });

  it("escapes the rest of the business profile", () => {
    const html = statement({ address: payload, phone: payload, email: payload, vat_number: payload });
    expect(html).not.toContain(payload);
  });

  it("escapes a hostile logo_url, so it cannot break out of the src attribute", () => {
    const html = statement({ logo_url: '"><script>alert(1)</script><img src="x' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&quot;");
  });

  it("escapes a hostile document reference in a statement row", () => {
    const html = buildStatementHTML(
      business(),
      "Sarah Dlamini",
      [{ date: payload, reference: payload, amount: 1, balance: 1, paid: false }],
      { invoiced: 1, received: 0, outstanding: 1 },
      "2026-07-17"
    );
    expect(html).not.toContain(payload);
  });

  it("escapes a hostile payment method and reference on a remittance", () => {
    const html = buildRemittanceHTML(business(), "Pipe Co", remittanceLines, {
      method: payload,
      date: payload,
      reference: payload,
      total: 800,
    });
    expect(html).not.toContain(payload);
  });
});

describe("the ledger itself", () => {
  it("still renders the rows and totals it is for", () => {
    const html = statement();
    expect(html).toContain("INV-2026-0001");
    expect(html).toContain("✓ Paid");
    expect(html).toContain("Sarah Dlamini");
  });

  it("renders remittance rows and the payment total", () => {
    const html = remittance();
    expect(html).toContain("SUP-914");
    expect(html).toContain("Pipe Co");
    expect(html).toContain("EFT");
  });
});
