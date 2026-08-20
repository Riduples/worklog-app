import { describe, expect, it } from "vitest";
import { computePnl, expenseCategoryTotals, revenueCategoryTotals, UNCATEGORISED } from "@/lib/pnl";
import { incomeNet } from "@/lib/taxRates";
import type { Tables } from "@/lib/types/database";

// Only the fields computePnl reads; the rest of each row is noise here.
const income = (over: Partial<Tables<"income">> = {}) =>
  ({ id: "in1", transaction_date: "2026-07-10", amount: 1150, vat_amount: 150, matched_invoice_id: null, matched_ledger_entry_id: null, ...over }) as Tables<"income">;
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

  it("ignores a client ledger entry on the cost side — that's money owed TO you", () => {
    // 'client', not 'customer': that is the value 0017's CHECK constraint allows.
    // This test asserted against 'customer' until 0123, so it passed for the
    // wrong reason — any unrecognised value falls out of a === "supplier" filter.
    const p = computePnl({ ledger: [ledgerEntry({ ledger_type: "client", amount: 800 })] }, all);
    expect(p.supplierCreditIncurred).toBe(0);
    expect(p.costs).toBe(0);
  });

  it("counts a client ledger entry as revenue when the credit is extended", () => {
    // The asymmetry 0123 closes: a supplier entry was a cost the moment it was
    // raised, while a credit sale reached revenue nowhere at all.
    const p = computePnl({ ledger: [ledgerEntry({ ledger_type: "client", amount: 1500 })] }, all);
    expect(p.clientCreditExtended).toBe(1500);
    expect(p.revenue).toBe(1500);
    expect(p.profit).toBe(1500);
  });

  it("does not count a client ledger entry and the receipt that settles it twice", () => {
    // The mirror of the supplier case above, and the reason the matched column
    // had to ship WITH the revenue change: counting the entry without netting the
    // receipt would turn an under-count into a double-count.
    const p = computePnl(
      {
        ledger: [ledgerEntry({ ledger_type: "client", amount: 1500 })],
        income: [income({ amount: 1500, vat_amount: 0, matched_ledger_entry_id: "le1" })],
      },
      all
    );
    expect(p.revenue).toBe(1500);
  });

  it("still counts an unlinked receipt on top — it is a different sale", () => {
    // Netting is per link, never a blanket "ignore cash when a ledger entry
    // exists". Two customers, one on credit and one paying cash, is 2500.
    const p = computePnl(
      {
        ledger: [ledgerEntry({ ledger_type: "client", amount: 1500 })],
        income: [income({ id: "i9", amount: 1000, vat_amount: 0 })],
      },
      all
    );
    expect(p.revenue).toBe(2500);
  });

  it("keeps a client ledger entry out of the single-account cash view", () => {
    // Cash basis is one account's own movements; a credit sale is a business-wide
    // claim that is not money in any account yet.
    const p = computePnl({ ledger: [ledgerEntry({ ledger_type: "client", amount: 1500 })] }, all, { cashBasis: true });
    expect(p.clientCreditExtended).toBe(0);
    expect(p.revenue).toBe(0);
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

// ── Category breakdown ───────────────────────────────────────────────────────
// The property that matters most is the last one in each block: the breakdown
// has to add up to the total printed above it. A list that counts a different
// set of rows than its own total is worse than no list at all.

const amountOf = (rows: { category: string; amount: number }[], cat: string) =>
  rows.find((r) => r.category === cat)?.amount ?? 0;
const sum = (rows: { amount: number }[]) => rows.reduce((s, r) => s + r.amount, 0);

describe("revenueCategoryTotals", () => {
  it("reads an invoice's categories off its lines, not off the invoice", () => {
    const inv = invoice({
      invoice_amount: 1000,
      line_items: [
        { desc: "Labour", qty: 1, unit_price: 600, sars_category: "Trading income — Services rendered" },
        { desc: "Parts", qty: 1, unit_price: 400, sars_category: "Trading income — Sale of goods" },
      ],
    } as Partial<Tables<"invoices">>);
    const rows = revenueCategoryTotals({ invoices: [inv] }, all);
    expect(amountOf(rows, "Trading income — Services rendered")).toBe(600);
    expect(amountOf(rows, "Trading income — Sale of goods")).toBe(400);
  });

  it("counts cash income under its own category — no document to inherit from", () => {
    const rows = revenueCategoryTotals(
      { income: [income({ amount: 1150, vat_amount: 150, sars_category: "Other income — Interest received" })] },
      all
    );
    // Ex-VAT, like every figure in this file.
    expect(amountOf(rows, "Other income — Interest received")).toBe(1000);
  });

  it("ignores a payment settling an invoice — the invoice already carried it", () => {
    const inv = invoice({ invoice_amount: 1000, line_items: [{ desc: "Job", qty: 1, unit_price: 1000, sars_category: "Trading income — Services rendered" }] } as Partial<Tables<"invoices">>);
    const rows = revenueCategoryTotals(
      { invoices: [inv], income: [income({ amount: 1150, vat_amount: 150, matched_invoice_id: inv.id, sars_category: null })] },
      all
    );
    expect(sum(rows)).toBe(1000);
  });

  it("unwinds a customer credit against the heading the sale landed under", () => {
    const inv = invoice({ id: "iv1", invoice_amount: 1000, line_items: [{ desc: "Job", qty: 1, unit_price: 1000, sars_category: "Trading income — Services rendered" }] } as Partial<Tables<"invoices">>);
    const rows = revenueCategoryTotals(
      { invoices: [inv], creditNotes: [creditNote({ invoice_id: "iv1", amount: 575, vat_amount: 75, line_items: [] })] },
      all
    );
    expect(amountOf(rows, "Trading income — Services rendered")).toBe(500);
  });

  it("puts an uncategorised invoice somewhere visible rather than dropping it", () => {
    const rows = revenueCategoryTotals({ invoices: [invoice({ invoice_amount: 1000, line_items: [] } as Partial<Tables<"invoices">>)] }, all);
    expect(amountOf(rows, UNCATEGORISED)).toBe(1000);
  });

  it("adds up to computePnl's revenue — the whole point", () => {
    const inputs = {
      invoices: [invoice({ id: "iv1", invoice_amount: 8000, line_items: [
        { desc: "Labour", qty: 1, unit_price: 5000, sars_category: "Trading income — Services rendered" },
        { desc: "Parts", qty: 1, unit_price: 3000, sars_category: "Trading income — Sale of goods" },
      ] } as Partial<Tables<"invoices">>)],
      income: [
        income({ id: "i1", amount: 1150, vat_amount: 150, sars_category: "Other income — Interest received" }),
        income({ id: "i2", amount: 2300, vat_amount: 300, matched_invoice_id: "iv1" }),
        income({ id: "i3", amount: 900, is_personal: true }),
      ],
      creditNotes: [creditNote({ invoice_id: "iv1", amount: 575, vat_amount: 75 })],
    };
    expect(sum(revenueCategoryTotals(inputs, all))).toBeCloseTo(computePnl(inputs, all).revenue, 6);
  });

  it("puts a client ledger entry under Uncategorised and still reconciles", () => {
    // The credit book records an amount owed and nothing about what was sold, so
    // there is no category to read. Showing it as Uncategorised is what keeps the
    // breakdown adding up to the revenue printed above it; dropping it would put
    // the list quietly under the total, which is the failure this pairing exists
    // to prevent.
    const inputs = {
      ledger: [ledgerEntry({ ledger_type: "client", amount: 1500 })],
      income: [income({ id: "i1", amount: 1150, vat_amount: 150, sars_category: "Other income — Interest received" })],
    };
    const rows = revenueCategoryTotals(inputs, all);
    expect(rows.find((r) => r.category === UNCATEGORISED)?.amount).toBe(1500);
    expect(sum(rows)).toBeCloseTo(computePnl(inputs, all).revenue, 6);
  });

  it("leaves out the receipt that settles a ledger entry, as the total does", () => {
    const inputs = {
      ledger: [ledgerEntry({ ledger_type: "client", amount: 1500 })],
      income: [income({ amount: 1500, vat_amount: 0, matched_ledger_entry_id: "le1", sars_category: "Other income — Interest received" })],
    };
    const rows = revenueCategoryTotals(inputs, all);
    // Only the entry itself, under Uncategorised — not the receipt's category too.
    expect(rows).toEqual([{ category: UNCATEGORISED, amount: 1500, count: 1 }]);
    expect(sum(rows)).toBeCloseTo(computePnl(inputs, all).revenue, 6);
  });
});

describe("expenseCategoryTotals", () => {
  it("reads a supplier invoice's categories off its lines", () => {
    const si = supplierInvoice({ invoice_amount: 500, line_items: [
      { desc: "Cleaning stuff", qty: 1, unit_price: 300, sars_category: "Premises — Cleaning costs" },
      { desc: "Paper", qty: 1, unit_price: 200, sars_category: "Admin — Stationery & printing" },
    ] } as Partial<Tables<"supplier_invoices">>);
    const rows = expenseCategoryTotals({ supplierInvoices: [si] }, all);
    // One supplier, two headings — the case a per-supplier default cannot cover.
    expect(amountOf(rows, "Premises — Cleaning costs")).toBe(300);
    expect(amountOf(rows, "Admin — Stationery & printing")).toBe(200);
  });

  it("leaves out the owner's own money and refund settlements", () => {
    const rows = expenseCategoryTotals(
      {
        expenses: [
          expense({ id: "1", amount: 900, sars_category: "Drawings", is_personal: true }),
          expense({ id: "2", amount: 575, sars_category: "Refund", is_credit_settlement: true }),
          expense({ id: "3", amount: 100, sars_category: "Cost of sales — Materials" }),
        ],
      },
      all
    );
    expect(rows).toEqual([{ category: "Cost of sales — Materials", amount: 100, count: 1 }]);
  });

  it("leaves out an expense settling a document — the document carried it", () => {
    const rows = expenseCategoryTotals(
      {
        supplierInvoices: [supplierInvoice({ id: "si1", invoice_amount: 344, line_items: [{ desc: "Stock", qty: 1, unit_price: 344, sars_category: "Cost of sales — Trading stock" }] } as Partial<Tables<"supplier_invoices">>)],
        expenses: [expense({ id: "1", amount: 344, sars_category: "Cost of sales — Materials", matched_supplier_invoice_id: "si1" })],
      },
      all
    );
    expect(amountOf(rows, "Cost of sales — Trading stock")).toBe(344);
    expect(amountOf(rows, "Cost of sales — Materials")).toBe(0);
  });

  it("shows supplier ledger credit as uncategorised — the credit book records no category", () => {
    const rows = expenseCategoryTotals({ ledger: [ledgerEntry({ amount: 800 })] }, all);
    expect(amountOf(rows, UNCATEGORISED)).toBe(800);
  });

  it("keeps matched rows and their own categories on the cash basis", () => {
    const rows = expenseCategoryTotals(
      { expenses: [expense({ id: "1", amount: 344, sars_category: "Cost of sales — Trading stock", matched_supplier_invoice_id: "si1" })] },
      all,
      { cashBasis: true }
    );
    expect(amountOf(rows, "Cost of sales — Trading stock")).toBe(344);
  });

  it("only counts rows inside the period", () => {
    const rows = expenseCategoryTotals(
      {
        expenses: [
          expense({ id: "1", amount: 100, transaction_date: "2026-07-10", sars_category: "Cost of sales — Materials" }),
          expense({ id: "2", amount: 999, transaction_date: "2026-08-10", sars_category: "Cost of sales — Materials" }),
        ],
      },
      (d) => d.startsWith("2026-07")
    );
    expect(amountOf(rows, "Cost of sales — Materials")).toBe(100);
  });

  it("adds up to computePnl's costs — the whole point", () => {
    const inputs = {
      supplierInvoices: [supplierInvoice({ id: "si1", invoice_amount: 500, line_items: [
        { desc: "Cleaning", qty: 1, unit_price: 300, sars_category: "Premises — Cleaning costs" },
        { desc: "Paper", qty: 1, unit_price: 200, sars_category: "Admin — Stationery & printing" },
      ] } as Partial<Tables<"supplier_invoices">>)],
      ledger: [ledgerEntry({ amount: 800 })],
      expenses: [
        expense({ id: "1", amount: 500, matched_supplier_invoice_id: "si1" }),
        expense({ id: "2", amount: 120, sars_category: "Motor vehicle — Fuel & oil" }),
        expense({ id: "3", amount: 900, is_personal: true }),
      ],
      creditNotes: [creditNote({ ledger: "supplier", supplier_invoice_id: "si1", amount: 115, vat_amount: 15 })],
    };
    expect(sum(expenseCategoryTotals(inputs, all))).toBeCloseTo(computePnl(inputs, all).costs, 6);
  });

  it("reconciles even when the lines do not add up to the document total", () => {
    // A discount, a rounding, or a historic line shape can leave lines short of
    // the stored amount. The stored amount is the authority, so the breakdown
    // allocates it pro rata rather than summing the lines and drifting.
    const si = supplierInvoice({ invoice_amount: 1000, line_items: [
      { desc: "A", qty: 1, unit_price: 300, sars_category: "Premises — Cleaning costs" },
      { desc: "B", qty: 1, unit_price: 100, sars_category: "Admin — Stationery & printing" },
    ] } as Partial<Tables<"supplier_invoices">>);
    const rows = expenseCategoryTotals({ supplierInvoices: [si] }, all);
    expect(sum(rows)).toBe(1000);
    expect(amountOf(rows, "Premises — Cleaning costs")).toBe(750);
    expect(amountOf(rows, "Admin — Stationery & printing")).toBe(250);
  });
});

describe("cash purchases are counted ex-VAT", () => {
  it("takes the VAT out of a cash expense, the way it does for a cash sale", () => {
    // R1,150 paid, R150 of it VAT the business claims back from SARS — so the
    // cost it actually bore is R1,000. Counting the gross overstated it.
    const p = computePnl({ expenses: [expense({ amount: 1150, vat_amount: 150 })] }, all);
    expect(p.costs).toBe(1000);
  });

  it("leaves a pre-VAT expense row exactly as it was", () => {
    // vat_amount 0 on every row logged before expenses carried VAT, so no
    // historic report moves.
    const p = computePnl({ expenses: [expense({ amount: 500 })] }, all);
    expect(p.costs).toBe(500);
  });

  it("nets a matched payment at the same ex-VAT value it was counted at", () => {
    // The supplier invoice carries the cost; the payment settling it must cancel
    // out exactly, or a stray few rand of VAT survives as phantom cost.
    const p = computePnl(
      {
        supplierInvoices: [supplierInvoice({ id: "si1", invoice_amount: 1000 })],
        expenses: [expense({ amount: 1150, vat_amount: 150, matched_supplier_invoice_id: "si1" })],
      },
      all
    );
    expect(p.costs).toBe(1000);
  });

  it("keeps the category breakdown footing to the total", () => {
    // The invariant the file promises: expenseCategoryTotals sums to costs.
    const inputs = {
      expenses: [
        expense({ id: "1", amount: 1150, vat_amount: 150, sars_category: "Cost of sales — Materials" }),
        expense({ id: "2", amount: 575, vat_amount: 75, sars_category: "Motor vehicle — Fuel & oil" }),
      ],
    };
    const total = expenseCategoryTotals(inputs, all).reduce((s, r) => s + r.amount, 0);
    expect(total).toBeCloseTo(computePnl(inputs, all).costs, 6);
    expect(total).toBe(1500);
  });
});
