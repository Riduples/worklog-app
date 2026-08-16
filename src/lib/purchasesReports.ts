// The four Purchases Reports, rolled up.
//
// Age Analysis already looks backwards at what is overdue and Remittance covers
// paying it. What was missing is the forward view — what you have committed to on
// order and what falls due next — and the full category schedule an accountant
// asks for, which P&L only shows the top eight of.

import type { SupplierInvoice } from "@/lib/supabase/hooks/useSupplierInvoices";
import type { PurchaseOrder } from "@/lib/supabase/hooks/usePurchaseOrders";
import type { Expense } from "@/lib/supabase/hooks/useExpenses";
import type { Contact } from "@/lib/supabase/hooks/useContacts";
import { addDays } from "@/lib/format";

const num = (v: unknown) => Number(v || 0);
const inclVat = (r: { invoice_amount?: number | null; total_amount?: number | null; vat_amount?: number | null }) =>
  num(r.invoice_amount ?? r.total_amount) + num(r.vat_amount);

// ── Spend by supplier ────────────────────────────────────────────────────────

export type SupplierSpendRow = {
  name: string;
  /** Billed on supplier invoices, VAT included. */
  billed: number;
  /** Paid out of the expense ledger to this supplier. */
  paid: number;
  outstanding: number;
  invoices: number;
  terms: string;
};

export type SupplierSpendTotals = { suppliers: number; billed: number; paid: number; outstanding: number };

/**
 * What each supplier cost you.
 *
 * Billed comes off supplier invoices and paid off the expense ledger. They are
 * two views of the same relationship rather than two halves of one total: an
 * expense paid straight to a supplier may never have been billed through an
 * invoice, and an invoice may not be paid yet. Adding them would double-count
 * everything that went through both.
 */
export function aggregateSupplierSpend(
  supplierInvoices: SupplierInvoice[],
  expenses: Expense[],
  contacts: Contact[],
  within: (d: string) => boolean
): { rows: SupplierSpendRow[]; totals: SupplierSpendTotals } {
  const byName = new Map<string, SupplierSpendRow>();
  const row = (name: string) => {
    const key = name.trim() || "—";
    let r = byName.get(key);
    if (!r) {
      const contact = contacts.find((c) => c.contact_type === "supplier" && c.name.trim().toLowerCase() === key.toLowerCase());
      r = { name: key, billed: 0, paid: 0, outstanding: 0, invoices: 0, terms: contact?.payment_terms ?? "" };
      byName.set(key, r);
    }
    return r;
  };

  for (const si of supplierInvoices) {
    if (!within(si.issue_date ?? "")) continue;
    const r = row(si.supplier_name ?? "");
    r.billed += inclVat(si);
    r.invoices += 1;
    r.outstanding += num(si.balance_due);
  }

  for (const e of expenses) {
    // A personal expense isn't business spend, and a payroll expense belongs to
    // the pay run that wrote it rather than to a supplier.
    if (e.is_personal || e.source === "payroll") continue;
    if (!within(e.transaction_date ?? "")) continue;
    const name = (e.paid_to ?? "").trim();
    if (!name) continue;
    row(name).paid += num(e.amount);
  }

  const rows = [...byName.values()].sort((a, b) => Math.max(b.billed, b.paid) - Math.max(a.billed, a.paid) || a.name.localeCompare(b.name));

  return {
    rows,
    totals: {
      suppliers: rows.length,
      billed: rows.reduce((s, r) => s + r.billed, 0),
      paid: rows.reduce((s, r) => s + r.paid, 0),
      outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
    },
  };
}

// ── Spend by category ────────────────────────────────────────────────────────

export type CategorySpendRow = { category: string; amount: number; count: number; sharePct: number };

/**
 * Every SARS category with its total — the deduction schedule, in full.
 *
 * P&L shows the top eight for a period, which is a summary; this is the list an
 * accountant works from. Personal spend is excluded because it isn't deductible,
 * and a credit settlement is excluded because it moves money against a credit
 * note rather than buying anything.
 */
export function aggregateCategorySpend(
  expenses: Expense[],
  within: (d: string) => boolean
): { rows: CategorySpendRow[]; totals: { total: number; count: number; categories: number; uncategorised: number } } {
  const byCat = new Map<string, { amount: number; count: number }>();
  let total = 0;
  let count = 0;

  for (const e of expenses) {
    if (e.is_personal || e.is_credit_settlement) continue;
    if (!within(e.transaction_date ?? "")) continue;
    const category = (e.sars_category ?? "").trim() || "Uncategorised";
    const cur = byCat.get(category) ?? { amount: 0, count: 0 };
    cur.amount += num(e.amount);
    cur.count += 1;
    byCat.set(category, cur);
    total += num(e.amount);
    count += 1;
  }

  const rows = [...byCat.entries()]
    .map(([category, v]) => ({ category, amount: v.amount, count: v.count, sharePct: total > 0 ? (v.amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));

  return {
    rows,
    totals: {
      total,
      count,
      categories: rows.length,
      uncategorised: rows.find((r) => r.category === "Uncategorised")?.amount ?? 0,
    },
  };
}

// ── Committed on order ───────────────────────────────────────────────────────

export type CommittedRow = {
  id: string;
  supplier: string;
  docNumber: string;
  issueDate: string;
  requestedDelivery: string;
  status: string;
  amount: number;
  /** Days since the order was raised — an old open PO is the one to chase. */
  ageDays: number;
};

/**
 * Purchase orders raised but not yet billed: money promised that isn't on the
 * books.
 *
 * A PO is settled once a supplier invoice links back to it, so those drop out
 * even while the PO's own status still says pending — the invoice is the truth
 * about whether it has landed. Cancelled orders are not a commitment.
 */
export function aggregateCommitted(
  purchaseOrders: PurchaseOrder[],
  supplierInvoices: SupplierInvoice[],
  today: string
): { rows: CommittedRow[]; totals: { orders: number; amount: number; overdue: number; overdueAmount: number } } {
  const billedPoIds = new Set(supplierInvoices.map((si) => si.linked_po_id).filter(Boolean) as string[]);

  const rows: CommittedRow[] = purchaseOrders
    .filter((po) => po.status !== "cancelled" && po.status !== "fulfilled" && !billedPoIds.has(po.id))
    .map((po) => {
      const issueDate = po.issue_date ?? "";
      return {
        id: po.id,
        supplier: po.supplier_name ?? "",
        docNumber: po.doc_number ?? "",
        issueDate,
        requestedDelivery: po.requested_delivery ?? "",
        status: po.status,
        amount: inclVat(po),
        ageDays: issueDate ? daysBetween(issueDate, today) : 0,
      };
    })
    .sort((a, b) => b.ageDays - a.ageDays || b.amount - a.amount);

  // Past its requested delivery date and still not billed — the chase list.
  const overdue = rows.filter((r) => r.requestedDelivery && r.requestedDelivery < today);

  return {
    rows,
    totals: {
      orders: rows.length,
      amount: rows.reduce((s, r) => s + r.amount, 0),
      overdue: overdue.length,
      overdueAmount: overdue.reduce((s, r) => s + r.amount, 0),
    },
  };
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

// ── Bills due ────────────────────────────────────────────────────────────────

export type BillDueBucket = "overdue" | "week" | "month" | "later" | "undated";

export type BillDueRow = {
  id: string;
  supplier: string;
  docNumber: string;
  dueDate: string;
  amount: number;
  bucket: BillDueBucket;
  daysAway: number;
};

export const BILL_BUCKET_LABEL: Record<BillDueBucket, string> = {
  overdue: "Overdue",
  week: "Due within 7 days",
  month: "Due within 30 days",
  later: "Later",
  undated: "No due date",
};

/**
 * What has to be paid, and when — the forward half that ageing doesn't give you.
 *
 * Only what is still owed: a paid or credited bill has no balance to plan for.
 */
export function aggregateBillsDue(
  supplierInvoices: SupplierInvoice[],
  today: string
): { rows: BillDueRow[]; totals: Record<BillDueBucket, number> & { total: number; count: number } } {
  const week = addDays(today, 7);
  const month = addDays(today, 30);

  const rows: BillDueRow[] = supplierInvoices
    .filter((si) => si.status !== "paid" && si.status !== "credited" && num(si.balance_due) > 0)
    .map((si) => {
      const dueDate = si.due_date ?? "";
      const bucket: BillDueBucket = !dueDate
        ? "undated"
        : dueDate < today
          ? "overdue"
          : dueDate <= week
            ? "week"
            : dueDate <= month
              ? "month"
              : "later";
      return {
        id: si.id,
        supplier: si.supplier_name ?? "",
        docNumber: si.doc_number ?? si.supplier_ref_number ?? "",
        dueDate,
        amount: num(si.balance_due),
        bucket,
        daysAway: dueDate ? daysBetween(today, dueDate) || -daysBetween(dueDate, today) : 0,
      };
    })
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || b.amount - a.amount);

  const sumOf = (bucket: BillDueBucket) => rows.filter((r) => r.bucket === bucket).reduce((s, r) => s + r.amount, 0);

  return {
    rows,
    totals: {
      overdue: sumOf("overdue"),
      week: sumOf("week"),
      month: sumOf("month"),
      later: sumOf("later"),
      undated: sumOf("undated"),
      total: rows.reduce((s, r) => s + r.amount, 0),
      count: rows.length,
    },
  };
}
