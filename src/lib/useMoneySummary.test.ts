import { describe, expect, it } from "vitest";
import { computePnl } from "@/lib/pnl";
import type { Tables } from "@/lib/types/database";

// The dashboard hero and the Profit & Loss report now read one shared summary
// (useMoneySummary), which assembles computePnl's inputs in a single place.
// These lock in the divergence that made that necessary: the hero used to build
// its own inputs and left creditNotes out, so it reported a profit its own P&L
// report contradicted. Testing the input set directly — the hook itself is a
// thin wrapper over TanStack queries.
const all = () => true;

const invoice = (over: Partial<Tables<"invoices">> = {}) =>
  ({ id: "iv1", issue_date: "2026-07-10", invoice_amount: 10000, ...over }) as Tables<"invoices">;
const creditNote = (over: Partial<Tables<"credit_notes">> = {}) =>
  ({ id: "cn1", ledger: "customer", issue_date: "2026-07-12", amount: 1150, vat_amount: 150, ...over }) as Tables<"credit_notes">;

describe("shared money summary inputs", () => {
  it("omitting creditNotes overstates profit by the credit's ex-VAT value", () => {
    const invoices = [invoice()];
    const creditNotes = [creditNote()];

    const withCredits = computePnl({ invoices, creditNotes }, all);
    const withoutCredits = computePnl({ invoices }, all);

    // R1 150 incl. R150 VAT — the customer credit reduces revenue by R1 000.
    expect(withCredits.profit).toBe(9000);
    expect(withoutCredits.profit).toBe(10000);
    expect(withoutCredits.profit - withCredits.profit).toBe(1000);
  });

  it("a supplier credit note cuts the other way, so the omission is not one-directional", () => {
    const creditNotes = [creditNote({ ledger: "supplier", amount: 575, vat_amount: 75 })];
    const supplierInvoices = [{ id: "si1", issue_date: "2026-07-10", invoice_amount: 2000 } as Tables<"supplier_invoices">];

    const withCredits = computePnl({ supplierInvoices, creditNotes }, all);
    const withoutCredits = computePnl({ supplierInvoices }, all);

    // Supplier credit reduces COST, so leaving it out understates profit here —
    // which is why the fix is one shared input set, not a sign correction.
    expect(withCredits.profit).toBe(-1500);
    expect(withoutCredits.profit).toBe(-2000);
  });
});
