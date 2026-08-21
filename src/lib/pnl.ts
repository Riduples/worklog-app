import type { Tables } from "@/lib/types/database";
import type { CreditNote } from "@/lib/creditNotes";
import { incomeNet, expenseNet } from "@/lib/taxRates";
import { salesLineTotal } from "@/lib/lineItems";

// The one place profit is defined, so the dashboard and the Profit & Loss report
// can never disagree about it again. Both used to compute their own — the
// dashboard on cash alone, the report on accrual — and the two showed different
// profits for the same month. Now both call this.
//
// Accrual, and ex-VAT throughout:
//   revenue = invoices issued + client credit extended
//              + cash income not already settling one of those
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
  creditNotes?: CreditNote[] | null;
};

export type Pnl = {
  // revenue side
  invoicesIssued: number;
  /** Credit sales raised in the period — the client half of the ledger book. */
  clientCreditExtended: number;
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

/**
 * `within` is an inPeriod(period) predicate over a YYYY-MM-DD string.
 *
 * `cashBasis` is for a single bank account's own view: every rand that moved
 * through the account is revenue (ex-VAT) or cost, with no accrual netting. The
 * accrual path nets a payment against the invoice/credit it settles, which only
 * balances when those documents are in the inputs — but an account holds its own
 * cash rows, not the business-wide invoices/credit, so running its matched rows
 * through the accrual path would silently zero every invoice-matched rand.
 */
export function computePnl(inputs: PnlInputs, within: (dateStr: string) => boolean, opts?: { cashBasis?: boolean }): Pnl {
  const { income, expenses, invoices, supplierInvoices, ledger, creditNotes } = inputs;

  // Refund settlements are the cash leg of a credit note that already adjusted
  // profit when it was raised (customer refund out, supplier refund in). Counting
  // that cash here too would hit profit a second time, so it is skipped from every
  // income/expense reducer below, in both the accrual and cash-basis paths.

  // ── revenue ──
  const invoicesIssued = (invoices ?? [])
    .filter((i) => within(i.issue_date))
    .reduce((s, i) => s + Number(i.invoice_amount), 0);
  const cashIncome = (income ?? [])
    .filter((r) => within(r.transaction_date) && !r.is_credit_settlement && !r.is_personal)
    .reduce((s, r) => s + incomeNet(r), 0);
  // A receipt settling an invoice OR a client ledger entry is netted out once —
  // the document it settles already counted the amount. A row could in principle
  // carry both links, so match on OR and subtract it a single time; summing two
  // per-column totals would double-subtract it and understate revenue. Same
  // shape as expenseSettlingAccrual on the cost side.
  const incomeSettlingAccrual = (income ?? [])
    .filter((r) => within(r.transaction_date) && !r.is_credit_settlement && !r.is_personal && (r.matched_invoice_id || r.matched_ledger_entry_id))
    .reduce((s, r) => s + incomeNet(r), 0);
  const cashIncomeNotInvoiced = cashIncome - incomeSettlingAccrual;

  // ── costs ──
  // Ex-VAT, through expenseNet, for the same reason revenue goes through
  // incomeNet: the VAT inside a purchase is reclaimed from SARS, not a cost the
  // business bore, and a supplier invoice already contributes its ex-VAT amount.
  // Rows logged before expenses carried VAT hold vat_amount 0 and are unchanged.
  const cashExpense = (expenses ?? [])
    .filter((r) => within(r.transaction_date) && !r.is_credit_settlement && !r.is_personal)
    .reduce((s, r) => s + expenseNet(r), 0);

  // Cash basis: plain money-in/money-out for one account, no accrual netting.
  if (opts?.cashBasis) {
    return {
      invoicesIssued: 0,
      clientCreditExtended: 0,
      cashIncomeNotInvoiced: cashIncome,
      revenue: cashIncome,
      supplierInvoicesIssued: 0,
      supplierCreditIncurred: 0,
      cashExpensesNotMatched: cashExpense,
      costs: cashExpense,
      profit: cashIncome - cashExpense,
    };
  }

  // A credit sale is revenue when the credit is extended, the same way a supplier
  // entry is a cost when it is incurred. Until this existed the book was lopsided:
  // buying on credit hit the report immediately, selling on credit reached it
  // nowhere at all, so the more a business sold on account the smaller its
  // revenue looked. ledger_type is 'client' — that is the value the CHECK
  // constraint in 0017 allows, not 'customer'.
  //
  // Face value, not ex-VAT. A ledger entry is a bare amount owed with no VAT
  // breakdown to extract, so this matches the supplier side rather than inventing
  // a split. For a VAT-registered business a credit sale is better raised as an
  // invoice, which does carry the VAT.
  const clientCreditExtended = (ledger ?? [])
    .filter((e) => e.ledger_type === "client" && within(e.entry_date))
    .reduce((s, e) => s + Number(e.amount), 0);
  const revenue = invoicesIssued + clientCreditExtended + cashIncomeNotInvoiced;

  const supplierInvoicesIssued = (supplierInvoices ?? [])
    .filter((si) => within(si.issue_date))
    .reduce((s, si) => s + Number(si.invoice_amount), 0);
  const supplierCreditIncurred = (ledger ?? [])
    .filter((e) => e.ledger_type === "supplier" && within(e.entry_date))
    .reduce((s, e) => s + Number(e.amount), 0);
  // An expense settling a supplier invoice or a ledger credit is netted out once —
  // the document it settles already counted the amount. A row can carry both
  // matcher columns, so match on OR and subtract it a single time; summing two
  // per-column totals would double-subtract it and understate costs.
  const expenseSettlingAccrual = (expenses ?? [])
    .filter((r) => within(r.transaction_date) && !r.is_credit_settlement && !r.is_personal && (r.matched_ledger_entry_id || r.matched_supplier_invoice_id))
    .reduce((s, r) => s + expenseNet(r), 0);
  const cashExpensesNotMatched = cashExpense - expenseSettlingAccrual;

  // Credit notes are contra-revenue / contra-cost the moment they are raised: a
  // customer credit reduces revenue, a supplier credit reduces cost, each by its
  // EX-VAT value (amount is VAT-inclusive; vat_amount is SARS's money, never P&L).
  // Summed locally rather than via sumCredits(), which returns the incl-VAT total.
  // Business-wide like invoices, so they only net this accrual view — the single-
  // account cash-basis path above is left untouched.
  const customerCreditExVat = (creditNotes ?? [])
    .filter((c) => c.ledger === "customer" && within(c.issue_date))
    .reduce((s, c) => s + (Number(c.amount || 0) - Number(c.vat_amount || 0)), 0);
  const supplierCreditExVat = (creditNotes ?? [])
    .filter((c) => c.ledger === "supplier" && within(c.issue_date))
    .reduce((s, c) => s + (Number(c.amount || 0) - Number(c.vat_amount || 0)), 0);

  const revenueNetOfCredits = revenue - customerCreditExVat;
  const costs = supplierInvoicesIssued + supplierCreditIncurred + cashExpensesNotMatched - supplierCreditExVat;

  return {
    invoicesIssued,
    clientCreditExtended,
    cashIncomeNotInvoiced,
    revenue: revenueNetOfCredits,
    supplierInvoicesIssued,
    supplierCreditIncurred,
    cashExpensesNotMatched,
    costs,
    profit: revenueNetOfCredits - costs,
  };
}

// ── Category breakdown ───────────────────────────────────────────────────────
//
// Where each rand of revenue and cost sits, by SARS category.
//
// These live beside computePnl because they have to add up to it. A breakdown
// that counts a different set of rows than the total printed above it is worse
// than no breakdown, and keeping the two rules in one file is what stops them
// drifting apart. The tests assert the reconciliation directly.
//
// The category is read from the DOCUMENT wherever one exists — an invoice line
// knows what it sold, a supplier invoice line knows what was bought — and from
// the money row only when there is no document, which is the one case where the
// row is itself the record. That is the same rule the Income and Expense modals
// already follow when they null a matched payment's own category.

export const UNCATEGORISED = "Uncategorised";

/** A category with how many entries fed it — the schedule an accountant reads. */
export type CategoryBreakdown = { category: string; amount: number; count: number };

type LineLike = { sars_category?: string | null; qty?: number; unit_price?: number; labour?: number; materials?: number };

/**
 * Spread a document's ex-VAT total across its lines' categories, pro rata.
 *
 * Pro rata rather than summing the lines directly, because a document's stored
 * amount is the authority and its lines need not add up to it — a discount, a
 * rounding, or a historic line shape can all put the two slightly apart. Summing
 * lines would then produce a breakdown that misses the total by a few rand and
 * quietly stops reconciling. Allocating the real total guarantees it never can.
 *
 * A document with no lines, or lines carrying no category at all, puts its whole
 * amount under Uncategorised — visible rather than dropped.
 */
type Bucket = { amount: number; count: number };

function bump(into: Map<string, Bucket>, cat: string, amount: number) {
  const cur = into.get(cat) ?? { amount: 0, count: 0 };
  into.set(cat, { amount: cur.amount + amount, count: cur.count + 1 });
}

function allocate(into: Map<string, Bucket>, amountExVat: number, lines: LineLike[] | null | undefined, sign = 1) {
  const rows = (lines ?? []).filter((l) => l && typeof l === "object");
  const weights = rows.map((l) => Math.abs(salesLineTotal(l)));
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  const add = (cat: string, amt: number) => bump(into, cat, sign * amt);

  if (rows.length === 0 || totalWeight === 0) {
    add(UNCATEGORISED, amountExVat);
    return;
  }

  // Allocate all but the last line by weight, then give the remainder to the last
  // one, so rounding never loses or invents a cent against the document total.
  let allocated = 0;
  rows.forEach((line, i) => {
    const cat = line.sars_category || UNCATEGORISED;
    const share = i === rows.length - 1 ? amountExVat - allocated : (amountExVat * weights[i]) / totalWeight;
    allocated += share;
    add(cat, share);
  });
}

function sorted(totals: Map<string, Bucket>): CategoryBreakdown[] {
  return [...totals.entries()]
    .map(([category, b]) => ({ category, amount: b.amount, count: b.count }))
    .filter((r) => r.amount !== 0)
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
}

/**
 * Revenue by category. Sums to `computePnl(...).revenue` for the same inputs.
 *
 * Invoices carry their categories on their lines; a client ledger entry carries
 * none at all and lands under Uncategorised; cash income that isn't settling one
 * of those carries its own; and a customer credit note is contra-revenue, pushed
 * back against the categories of the invoice it credits, so crediting a sale
 * unwinds it from the same heading it landed under.
 */
export function revenueCategoryTotals(
  inputs: PnlInputs,
  within: (dateStr: string) => boolean,
  opts?: { cashBasis?: boolean }
): CategoryBreakdown[] {
  const { income, invoices, ledger, creditNotes } = inputs;
  const totals = new Map<string, Bucket>();

  // Cash basis (a single account): every rand received is revenue under its own
  // category, with no invoices to inherit from and no netting — the same shape
  // computePnl takes for that view.
  if (opts?.cashBasis) {
    for (const r of income ?? []) {
      if (!within(r.transaction_date) || r.is_credit_settlement || r.is_personal) continue;
      bump(totals, r.sars_category || UNCATEGORISED, incomeNet(r));
    }
    return sorted(totals);
  }

  const invoiceById = new Map((invoices ?? []).map((i) => [i.id, i]));

  for (const inv of invoices ?? []) {
    if (!within(inv.issue_date)) continue;
    allocate(totals, Number(inv.invoice_amount), inv.line_items as LineLike[] | null);
  }

  // Client ledger entries have no category to give — the credit book records an
  // amount owed and nothing about what was sold — so they land under
  // Uncategorised, exactly as supplier entries do on the cost side. They must
  // still appear, or the breakdown stops adding up to the revenue above it.
  for (const e of ledger ?? []) {
    if (e.ledger_type !== "client" || !within(e.entry_date)) continue;
    bump(totals, UNCATEGORISED, Number(e.amount));
  }

  // Cash income not already tied to an invoice or a ledger entry — the money row
  // is the record here, so its own category is the right one. Ex-VAT, as
  // everywhere in this file.
  for (const r of income ?? []) {
    if (!within(r.transaction_date) || r.is_credit_settlement || r.is_personal) continue;
    if (r.matched_invoice_id || r.matched_ledger_entry_id) continue;
    bump(totals, r.sars_category || UNCATEGORISED, incomeNet(r));
  }

  for (const cn of creditNotes ?? []) {
    if (cn.ledger !== "customer" || !within(cn.issue_date)) continue;
    const exVat = Number(cn.amount || 0) - Number(cn.vat_amount || 0);
    // Its own lines if it has them (a partial credit lists what was credited),
    // otherwise the credited invoice's — either way it lands where the sale did.
    const lines = (cn.line_items as LineLike[] | null) ?? null;
    const fallback = cn.invoice_id ? (invoiceById.get(cn.invoice_id)?.line_items as LineLike[] | null) : null;
    allocate(totals, exVat, lines?.length ? lines : fallback, -1);
  }

  return sorted(totals);
}

/**
 * Costs by category. Sums to `computePnl(...).costs` for the same inputs.
 *
 * `cashBasis` mirrors computePnl's single-account view: every rand that moved is
 * a cost, with no accrual documents and no netting, so each row's own category
 * stands.
 *
 * Supplier ledger entries have no category to give — the credit book records an
 * amount owed and nothing about what it bought — so they land under
 * Uncategorised until that table carries one too.
 */
export function expenseCategoryTotals(
  inputs: PnlInputs,
  within: (dateStr: string) => boolean,
  opts?: { cashBasis?: boolean }
): CategoryBreakdown[] {
  const { expenses, supplierInvoices, ledger, creditNotes } = inputs;
  const totals = new Map<string, Bucket>();

  const ownCategory = (r: { sars_category?: string | null }) => r.sars_category || UNCATEGORISED;

  if (opts?.cashBasis) {
    for (const r of expenses ?? []) {
      if (!within(r.transaction_date) || r.is_credit_settlement || r.is_personal) continue;
      bump(totals, ownCategory(r), expenseNet(r));
    }
    return sorted(totals);
  }

  const supplierInvoiceById = new Map((supplierInvoices ?? []).map((si) => [si.id, si]));

  for (const si of supplierInvoices ?? []) {
    if (!within(si.issue_date)) continue;
    allocate(totals, Number(si.invoice_amount), si.line_items as LineLike[] | null);
  }

  for (const e of ledger ?? []) {
    if (e.ledger_type !== "supplier" || !within(e.entry_date)) continue;
    bump(totals, UNCATEGORISED, Number(e.amount));
  }

  // Cash expenses not settling a supplier invoice or ledger entry. A settling
  // payment is excluded because the document it settles already carried the
  // amount — and the category with it.
  for (const r of expenses ?? []) {
    if (!within(r.transaction_date) || r.is_credit_settlement || r.is_personal) continue;
    if (r.matched_ledger_entry_id || r.matched_supplier_invoice_id) continue;
    // Ex-VAT, exactly as computePnl counts it — this breakdown has to foot to
    // that total, so the two can never read an expense row differently.
    bump(totals, ownCategory(r), expenseNet(r));
  }

  for (const cn of creditNotes ?? []) {
    if (cn.ledger !== "supplier" || !within(cn.issue_date)) continue;
    const exVat = Number(cn.amount || 0) - Number(cn.vat_amount || 0);
    const lines = (cn.line_items as LineLike[] | null) ?? null;
    const fallback = cn.supplier_invoice_id
      ? (supplierInvoiceById.get(cn.supplier_invoice_id)?.line_items as LineLike[] | null)
      : null;
    allocate(totals, exVat, lines?.length ? lines : fallback, -1);
  }

  return sorted(totals);
}
