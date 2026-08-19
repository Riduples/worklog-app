import { describe, expect, it } from "vitest";
import { computePnl, expenseCategoryTotals } from "@/lib/pnl";
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
const creditNote = (over: Partial<Tables<"credit_notes">> = {}) =>
  ({ id: "cn1", ledger: "customer", issue_date: "2026-07-10", amount: 575, vat_amount: 75, ...over }) as Tables<"credit_notes">;

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

  it("a customer credit note reduces revenue by its ex-VAT value", () => {
    // R2000 revenue, less a R575 incl (R500 ex-VAT) customer credit → R1500.
    const p = computePnl(
      { invoices: [invoice({ invoice_amount: 2000 })], creditNotes: [creditNote({ ledger: "customer", amount: 575, vat_amount: 75 })] },
      all
    );
    expect(p.revenue).toBe(1500);
    expect(p.profit).toBe(1500);
  });

  it("a supplier credit note reduces cost by its ex-VAT value", () => {
    // R344 cost, less a R230 incl (R200 ex-VAT) supplier credit → R144.
    const p = computePnl(
      { supplierInvoices: [supplierInvoice({ invoice_amount: 344 })], creditNotes: [creditNote({ ledger: "supplier", amount: 230, vat_amount: 30 })] },
      all
    );
    expect(p.costs).toBe(144);
  });

  it("excludes a refund settlement from P&L — the credit note already adjusted profit", () => {
    // Customer refund (expense) and supplier refund (income), both flagged, must
    // not hit profit a second time (Cash Flow counts them; P&L must not).
    const p = computePnl(
      {
        income: [income({ amount: 230, vat_amount: 0, is_credit_settlement: true })],
        expenses: [expense({ amount: 500, is_credit_settlement: true })],
      },
      all
    );
    expect(p.revenue).toBe(0);
    expect(p.costs).toBe(0);
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

describe("expenseCategoryTotals", () => {
  it("groups by SARS category, biggest first", () => {
    const rows = [
      expense({ id: "1", amount: 100, sars_category: "Materials" }),
      expense({ id: "2", amount: 400, sars_category: "Fuel" }),
      expense({ id: "3", amount: 50, sars_category: "Materials" }),
    ];
    expect(expenseCategoryTotals(rows, all)).toEqual([
      ["Fuel", 400],
      ["Materials", 150],
    ]);
  });

  it("falls back to what_for, then Uncategorised, when no SARS category is set", () => {
    const rows = [
      expense({ id: "1", amount: 30, sars_category: null, what_for: "Airtime" }),
      expense({ id: "2", amount: 20, sars_category: null, what_for: null }),
    ];
    expect(expenseCategoryTotals(rows, all)).toEqual([
      ["Airtime", 30],
      ["Uncategorised", 20],
    ]);
  });

  it("leaves out the owner's own money — costs never counted it", () => {
    const rows = [
      expense({ id: "1", amount: 900, sars_category: "Drawings", is_personal: true }),
      expense({ id: "2", amount: 100, sars_category: "Materials" }),
    ];
    expect(expenseCategoryTotals(rows, all)).toEqual([["Materials", 100]]);
  });

  it("leaves out refund settlements — the credit note already adjusted profit", () => {
    const rows = [
      expense({ id: "1", amount: 575, sars_category: "Refund", is_credit_settlement: true }),
      expense({ id: "2", amount: 100, sars_category: "Materials" }),
    ];
    expect(expenseCategoryTotals(rows, all)).toEqual([["Materials", 100]]);
  });

  it("leaves out an expense settling a supplier invoice or ledger entry — the document carried it", () => {
    const rows = [
      expense({ id: "1", amount: 344, sars_category: "Stock", matched_supplier_invoice_id: "si1" }),
      expense({ id: "2", amount: 800, sars_category: "Stock", matched_ledger_entry_id: "le1" }),
      expense({ id: "3", amount: 100, sars_category: "Materials" }),
    ];
    expect(expenseCategoryTotals(rows, all)).toEqual([["Materials", 100]]);
  });

  it("keeps matched rows on the cash basis, where nothing is netted", () => {
    const rows = [
      expense({ id: "1", amount: 344, sars_category: "Stock", matched_supplier_invoice_id: "si1" }),
      expense({ id: "2", amount: 100, sars_category: "Materials" }),
    ];
    expect(expenseCategoryTotals(rows, all, { cashBasis: true })).toEqual([
      ["Stock", 344],
      ["Materials", 100],
    ]);
  });

  it("only counts rows inside the period", () => {
    const rows = [
      expense({ id: "1", amount: 100, transaction_date: "2026-07-10", sars_category: "Materials" }),
      expense({ id: "2", amount: 999, transaction_date: "2026-08-10", sars_category: "Materials" }),
    ];
    expect(expenseCategoryTotals(rows, (d) => d.startsWith("2026-07"))).toEqual([["Materials", 100]]);
  });

  it("sums to the cash expense line computePnl reports, so the breakdown reconciles", () => {
    // The regression this pairing exists for: the list used to include personal
    // and matched rows the total above it excluded, so it could sum past the total.
    const rows = [
      expense({ id: "1", amount: 900, sars_category: "Drawings", is_personal: true }),
      expense({ id: "2", amount: 344, sars_category: "Stock", matched_supplier_invoice_id: "si1" }),
      expense({ id: "3", amount: 100, sars_category: "Materials" }),
      expense({ id: "4", amount: 60, sars_category: "Fuel" }),
    ];
    const pnl = computePnl({ expenses: rows, supplierInvoices: [supplierInvoice()] }, all);
    const breakdown = expenseCategoryTotals(rows, all).reduce((s, [, amt]) => s + amt, 0);
    expect(breakdown).toBe(pnl.cashExpensesNotMatched);
    expect(breakdown).toBe(160);
  });
});
