import { describe, expect, it } from "vitest";
import { computePnl } from "@/lib/pnl";
import { incomeNet } from "@/lib/taxRates";
import type { Tables } from "@/lib/types/database";

// Only the fields computePnl reads; the rest of each row is noise here.
const income = (over: Partial<Tables<"income">> = {}) =>
  ({ id: "in1", transaction_date: "2026-07-10", amount: 1150, vat_amount: 150, matched_invoice_id: null, ...over }) as Tables<"income">;
const expense = (over: Partial<Tables<"expenses">> = {}) =>
  ({ id: "ex1", transaction_date: "2026-07-10", amount: 500, matched_ledger_entry_id: null, matched_supplier_invoice_id: null, ...over }) as Tables<"expenses">;
const invoice = (over: Partial<Tables<"invoices">> = {}) =>
  ({ id: "iv1", issue_date: "2026-07-10", invoice_amount: 1000, ...over }) as Tables<"invoices">;
const supplierInvoice = (over: Partial<Tables<"supplier_invoices">> = {}) =>
  ({ id: "si1", issue_date: "2026-07-10", invoice_amount: 344, ...over }) as Tables<"supplier_invoices">;
const ledgerEntry = (over: Partial<Tables<"ledger_entries">> = {}) =>
  ({ id: "le1", ledger_type: "supplier", entry_date: "2026-07-10", amount: 800, ...over }) as Tables<"ledger_entries">;

const all = () => true;

describe("computePnl", () => {
  it("is all zeros with nothing to add up", () => {
    expect(computePnl({}, all)).toMatchObject({ revenue: 0, costs: 0, profit: 0 });
  });

  it("counts an issued invoice as revenue and cash income net of VAT", () => {
    const p = computePnl({ invoices: [invoice({ invoice_amount: 1000 })], income: [income({ amount: 1150, vat_amount: 150 })] }, all);
    expect(p.invoicesIssued).toBe(1000);
    expect(p.cashIncomeNotInvoiced).toBe(incomeNet(income({ amount: 1150, vat_amount: 150 }))); // 1000, VAT taken out
    expect(p.revenue).toBe(2000);
  });

  it("does not count a payment already tied to an invoice a second time", () => {
    // The invoice counted the sale when it was issued; the matched income must
    // not add it again, or one sale reads as two.
    const p = computePnl(
      { invoices: [invoice({ invoice_amount: 1000 })], income: [income({ amount: 1000, vat_amount: 0, matched_invoice_id: "iv1" })] },
      all
    );
    expect(p.revenue).toBe(1000);
  });

  it("counts supplier invoices and supplier credit as costs, plus unmatched cash", () => {
    const p = computePnl(
      { supplierInvoices: [supplierInvoice({ invoice_amount: 344 })], ledger: [ledgerEntry({ amount: 800 })], expenses: [expense({ amount: 500 })] },
      all
    );
    expect(p.supplierInvoicesIssued).toBe(344);
    expect(p.supplierCreditIncurred).toBe(800);
    expect(p.costs).toBe(344 + 800 + 500);
  });

  it("does not count a supplier invoice and the expense that pays it twice", () => {
    // The bug this whole change exists to prevent, from the report's side: a
    // R344 bill plus the R344 that settles it is R344 of cost, not R688.
    const p = computePnl(
      { supplierInvoices: [supplierInvoice({ invoice_amount: 344 })], expenses: [expense({ amount: 344, matched_supplier_invoice_id: "si1" })] },
      all
    );
    expect(p.costs).toBe(344);
  });

  it("does not count a supplier ledger entry and the expense that settles it twice", () => {
    const p = computePnl(
      { ledger: [ledgerEntry({ amount: 800 })], expenses: [expense({ amount: 800, matched_ledger_entry_id: "le1" })] },
      all
    );
    expect(p.costs).toBe(800);
  });

  it("ignores a customer ledger entry on the cost side — that's money owed TO you", () => {
    const p = computePnl({ ledger: [ledgerEntry({ ledger_type: "customer", amount: 800 })] }, all);
    expect(p.supplierCreditIncurred).toBe(0);
    expect(p.costs).toBe(0);
  });

  it("profit is revenue minus costs", () => {
    const p = computePnl(
      {
        invoices: [invoice({ invoice_amount: 2000 })],
        supplierInvoices: [supplierInvoice({ invoice_amount: 344 })],
      },
      all
    );
    expect(p.profit).toBe(2000 - 344);
  });

  it("only counts rows inside the period", () => {
    const july = (d: string) => d.startsWith("2026-07");
    const p = computePnl(
      {
        invoices: [invoice({ issue_date: "2026-07-10", invoice_amount: 1000 }), invoice({ id: "iv2", issue_date: "2026-06-10", invoice_amount: 9999 })],
        supplierInvoices: [supplierInvoice({ issue_date: "2026-07-05", invoice_amount: 344 }), supplierInvoice({ id: "si2", issue_date: "2026-08-01", invoice_amount: 9999 })],
      },
      july
    );
    expect(p.invoicesIssued).toBe(1000); // June's 9999 excluded
    expect(p.supplierInvoicesIssued).toBe(344); // August's 9999 excluded
  });
});
