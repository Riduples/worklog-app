import type { Tables } from "@/lib/types/database";
import { incomeNet } from "@/lib/taxRates";

// The one place profit is defined, so the dashboard and the Profit & Loss report
// can never disagree about it again. Both used to compute their own — the
// dashboard on cash alone, the report on accrual — and the two showed different
// profits for the same month. Now both call this.
//
// Accrual, and ex-VAT throughout:
//   revenue = invoices issued + cash income not already tied to an invoice
//   costs   = supplier invoices issued + supplier credit incurred
//              + cash expenses not already settling one of those
// A payment matched to the document it settles is netted out, because the
// document already counted the amount when it was issued/incurred — otherwise a
// bill and the cash that pays it read as double. VAT is SARS's money passing
// through, never revenue or cost, so income goes through incomeNet and the
// invoice/supplier-invoice figures are their ex-VAT amounts.

type Income = Tables<"income">;
type Expense = Tables<"expenses">;
type Invoice = Tables<"invoices">;
type SupplierInvoice = Tables<"supplier_invoices">;
type LedgerEntry = Tables<"ledger_entries">;

export type PnlInputs = {
  income?: Income[] | null;
  expenses?: Expense[] | null;
  invoices?: Invoice[] | null;
  supplierInvoices?: SupplierInvoice[] | null;
  ledger?: LedgerEntry[] | null;
};

export type Pnl = {
  // revenue side
  invoicesIssued: number;
  cashIncomeNotInvoiced: number;
  revenue: number;
  // cost side
  supplierInvoicesIssued: number;
  supplierCreditIncurred: number;
  cashExpensesNotMatched: number;
  costs: number;
  // bottom line
  profit: number;
};

/** `within` is an inPeriod(period) predicate over a YYYY-MM-DD string. */
export function computePnl(inputs: PnlInputs, within: (dateStr: string) => boolean): Pnl {
  const { income, expenses, invoices, supplierInvoices, ledger } = inputs;

  // ── revenue ──
  const invoicesIssued = (invoices ?? [])
    .filter((i) => within(i.issue_date))
    .reduce((s, i) => s + Number(i.invoice_amount), 0);
  const cashIncome = (income ?? []).filter((r) => within(r.transaction_date)).reduce((s, r) => s + incomeNet(r), 0);
  const incomeLinkedToInvoice = (income ?? [])
    .filter((r) => within(r.transaction_date) && r.matched_invoice_id)
    .reduce((s, r) => s + incomeNet(r), 0);
  const cashIncomeNotInvoiced = cashIncome - incomeLinkedToInvoice;
  const revenue = invoicesIssued + cashIncomeNotInvoiced;

  // ── costs ──
  const cashExpense = (expenses ?? []).filter((r) => within(r.transaction_date)).reduce((s, r) => s + Number(r.amount), 0);
  const supplierInvoicesIssued = (supplierInvoices ?? [])
    .filter((si) => within(si.issue_date))
    .reduce((s, si) => s + Number(si.invoice_amount), 0);
  const supplierCreditIncurred = (ledger ?? [])
    .filter((e) => e.ledger_type === "supplier" && within(e.entry_date))
    .reduce((s, e) => s + Number(e.amount), 0);
  const expenseSettlingCredit = (expenses ?? [])
    .filter((r) => within(r.transaction_date) && r.matched_ledger_entry_id)
    .reduce((s, r) => s + Number(r.amount), 0);
  const expenseSettlingSupplierInvoice = (expenses ?? [])
    .filter((r) => within(r.transaction_date) && r.matched_supplier_invoice_id)
    .reduce((s, r) => s + Number(r.amount), 0);
  const cashExpensesNotMatched = cashExpense - expenseSettlingCredit - expenseSettlingSupplierInvoice;
  const costs = supplierInvoicesIssued + supplierCreditIncurred + cashExpensesNotMatched;

  return {
    invoicesIssued,
    cashIncomeNotInvoiced,
    revenue,
    supplierInvoicesIssued,
    supplierCreditIncurred,
    cashExpensesNotMatched,
    costs,
    profit: revenue - costs,
  };
}
