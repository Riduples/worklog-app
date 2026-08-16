// The four Sales Reports, rolled up.
//
// Pure functions the screen and the PDF both read, so a printed copy can never
// disagree with the page — the same arrangement jobHours.ts and payrollReports.ts
// use, and the reason the arithmetic is testable at all.

import type { Invoice } from "@/lib/supabase/hooks/useInvoices";
import type { Quote } from "@/lib/supabase/hooks/useQuotes";
import type { CreditNote } from "@/lib/supabase/hooks/useCreditNotes";
import { salesLineTotal, type SalesLineItem } from "@/lib/lineItems";
import { RECURRENCE_LABEL, recurrenceNext, type Recurrence } from "@/lib/recurrence";
import { addDays } from "@/lib/format";

const num = (v: unknown) => Number(v || 0);

/** Invoiced excluding VAT, the way every total here is stated. */
const exVat = (inv: Invoice) => num(inv.invoice_amount);

// ── Sales summary ────────────────────────────────────────────────────────────

export type SalesMonthRow = {
  /** YYYY-MM. */
  month: string;
  invoices: number;
  invoiced: number;
  vat: number;
  credited: number;
  /** Invoiced less credit notes — the figure that belongs in a revenue line. */
  net: number;
  received: number;
  outstanding: number;
};

export type SalesSummaryTotals = {
  invoices: number;
  invoiced: number;
  vat: number;
  credited: number;
  net: number;
  received: number;
  outstanding: number;
  /** Share of net sales collected, 0–100. */
  collectedPct: number;
};

/**
 * Sales month by month: invoiced, VAT, credit notes, and what has come in
 * against what is still out.
 *
 * "Received" is read from the invoice rather than from the income rows so a
 * month's collection can be compared with the same month's billing without
 * matching payments back to the invoice they settled. A paid invoice counts in
 * full; a part-paid one counts its deposit.
 */
export function aggregateSalesSummary(
  invoices: Invoice[],
  creditNotes: CreditNote[],
  within: (d: string) => boolean
): { months: SalesMonthRow[]; totals: SalesSummaryTotals } {
  const scoped = invoices.filter((inv) => within(inv.issue_date ?? ""));
  const scopedCredits = creditNotes.filter((c) => c.ledger === "customer" && within(c.issue_date ?? ""));

  const byMonth = new Map<string, SalesMonthRow>();
  const row = (month: string) => {
    let r = byMonth.get(month);
    if (!r) {
      r = { month, invoices: 0, invoiced: 0, vat: 0, credited: 0, net: 0, received: 0, outstanding: 0 };
      byMonth.set(month, r);
    }
    return r;
  };

  for (const inv of scoped) {
    const r = row((inv.issue_date ?? "").slice(0, 7));
    const amount = exVat(inv);
    const received = inv.status === "paid" ? amount + num(inv.vat_amount) : num(inv.deposit_received);
    r.invoices += 1;
    r.invoiced += amount;
    r.vat += num(inv.vat_amount);
    r.received += received;
    // What is still owed on this invoice, never below zero — an over-payment is
    // not negative debt.
    r.outstanding += Math.max(0, amount + num(inv.vat_amount) - received);
  }
  for (const c of scopedCredits) {
    // Ex-VAT, to net against the ex-VAT invoiced total: c.amount is VAT-inclusive
    // and c.vat_amount is the SARS portion, so amount − vat_amount is the ex-VAT
    // credit (matches pnl.ts). Netting the inclusive amount understated Net sales
    // by the VAT within each credit note.
    row((c.issue_date ?? "").slice(0, 7)).credited += num(c.amount) - num(c.vat_amount);
  }

  const months = [...byMonth.values()]
    .map((r) => ({ ...r, net: r.invoiced - r.credited }))
    .sort((a, b) => b.month.localeCompare(a.month));

  const sum = (pick: (r: SalesMonthRow) => number) => months.reduce((s, r) => s + pick(r), 0);
  const net = sum((r) => r.net);
  const received = sum((r) => r.received);
  const outstanding = sum((r) => r.outstanding);

  return {
    months,
    totals: {
      invoices: sum((r) => r.invoices),
      invoiced: sum((r) => r.invoiced),
      vat: sum((r) => r.vat),
      credited: sum((r) => r.credited),
      net,
      received,
      outstanding,
      // Received and outstanding are both gross cash figures, so collected% is the
      // fraction of billed invoices collected — and reads 100% only when nothing is
      // outstanding. (received / net mixed gross over ex-VAT, so it could show 100%
      // collected while money was still owed.)
      collectedPct: received + outstanding > 0 ? Math.min(100, (received / (received + outstanding)) * 100) : 0,
    },
  };
}

// ── Quote conversion ─────────────────────────────────────────────────────────

export type QuoteOutcome = "converted" | "accepted" | "declined" | "expired" | "open";

export type QuoteConversionRow = { outcome: QuoteOutcome; label: string; count: number; value: number };

export type QuoteConversionTotals = {
  quotes: number;
  value: number;
  won: number;
  wonValue: number;
  lost: number;
  lostValue: number;
  open: number;
  openValue: number;
  /** Won as a share of everything decided — open quotes aren't a loss yet. */
  conversionRate: number;
};

const OUTCOME_LABEL: Record<QuoteOutcome, string> = {
  converted: "Converted to invoice",
  accepted: "Accepted, not yet invoiced",
  declined: "Declined",
  expired: "Expired",
  open: "Still open",
};

/**
 * What became of each quote.
 *
 * A quote sitting past its valid_until with nothing decided is counted expired
 * rather than open — it is a loss the register never marked, and leaving it in
 * "open" would flatter the conversion rate indefinitely.
 */
export function quoteOutcomeOf(q: Quote, today: string): QuoteOutcome {
  if (q.status === "converted" || q.converted_to_invoice_id) return "converted";
  if (q.status === "declined") return "declined";
  if (q.status === "accepted") return "accepted";
  if (q.valid_until && q.valid_until < today) return "expired";
  return "open";
}

export function aggregateQuoteConversion(
  quotes: Quote[],
  within: (d: string) => boolean,
  today: string
): { rows: QuoteConversionRow[]; totals: QuoteConversionTotals } {
  const scoped = quotes.filter((q) => within(q.issue_date ?? ""));
  const outcomes = scoped.map((q) => ({ q, outcome: quoteOutcomeOf(q, today) }));

  const order: QuoteOutcome[] = ["converted", "accepted", "open", "declined", "expired"];
  const rows = order
    .map((outcome) => {
      const mine = outcomes.filter((o) => o.outcome === outcome);
      return {
        outcome,
        label: OUTCOME_LABEL[outcome],
        count: mine.length,
        value: mine.reduce((s, o) => s + num(o.q.total_amount), 0),
      };
    })
    .filter((r) => r.count > 0);

  const pick = (...os: QuoteOutcome[]) => outcomes.filter((o) => os.includes(o.outcome));
  const valueOf = (list: typeof outcomes) => list.reduce((s, o) => s + num(o.q.total_amount), 0);

  const won = pick("converted", "accepted");
  const lost = pick("declined", "expired");
  const open = pick("open");
  const decided = won.length + lost.length;

  return {
    rows,
    totals: {
      quotes: scoped.length,
      value: valueOf(outcomes),
      won: won.length,
      wonValue: valueOf(won),
      lost: lost.length,
      lostValue: valueOf(lost),
      open: open.length,
      openValue: valueOf(open),
      conversionRate: decided > 0 ? (won.length / decided) * 100 : 0,
    },
  };
}

// ── What sells ───────────────────────────────────────────────────────────────

export type SoldItemRow = { description: string; qty: number; value: number; invoices: number };

/**
 * Invoice line items rolled up by what they say.
 *
 * Lines are matched on their description, case-folded — the price list isn't
 * referenced from a line, so the description is the only identity a sold line
 * has. Every total goes through salesLineTotal so the old labour/materials shape
 * and the current unit_price one both add up correctly.
 */
export function aggregateWhatSells(invoices: Invoice[], within: (d: string) => boolean): { rows: SoldItemRow[]; totals: { lines: number; value: number } } {
  const byDesc = new Map<string, SoldItemRow>();

  for (const inv of invoices) {
    if (!within(inv.issue_date ?? "")) continue;
    const lines = Array.isArray(inv.line_items) ? (inv.line_items as SalesLineItem[]) : [];
    const seen = new Set<string>();
    for (const line of lines) {
      const desc = (line?.desc ?? "").trim();
      if (!desc) continue;
      const key = desc.toLowerCase();
      const row = byDesc.get(key) ?? { description: desc, qty: 0, value: 0, invoices: 0 };
      row.qty += Number(line.qty ?? 1) || 1;
      row.value += salesLineTotal(line);
      // One invoice counts once towards a line's invoice count however many
      // times that line appears on it.
      if (!seen.has(key)) {
        row.invoices += 1;
        seen.add(key);
      }
      byDesc.set(key, row);
    }
  }

  const rows = [...byDesc.values()].sort((a, b) => b.value - a.value || a.description.localeCompare(b.description));
  return { rows, totals: { lines: rows.length, value: rows.reduce((s, r) => s + r.value, 0) } };
}

// ── Recurring revenue ────────────────────────────────────────────────────────

export type RecurringRow = {
  id: string;
  client: string;
  docNumber: string;
  recurrence: Recurrence;
  recurrenceLabel: string;
  nextRun: string;
  amount: number;
  /** The same amount stated per month, so different cycles can be added up. */
  perMonth: number;
};

// What one run is worth a month. Quarterly and annual are spread rather than
// counted whole, or a single annual invoice would read as a monthly commitment.
const PER_MONTH: Record<Recurrence, number> = { none: 0, weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, annual: 1 / 12 };

/**
 * The live recurring invoices and what they commit to each month.
 *
 * Only the parents count: a run creates a child invoice carrying
 * recurrence_parent_id, and counting those as well would multiply the commitment
 * by however many times it has already billed.
 */
export function aggregateRecurring(invoices: Invoice[], today: string): { rows: RecurringRow[]; totals: { count: number; perMonth: number; dueSoon: number } } {
  const rows: RecurringRow[] = invoices
    .filter((inv) => inv.recurrence && inv.recurrence !== "none" && !inv.recurrence_parent_id)
    .map((inv) => {
      const recurrence = inv.recurrence as Recurrence;
      const amount = num(inv.invoice_amount) + num(inv.vat_amount);
      return {
        id: inv.id,
        client: inv.client_name,
        docNumber: inv.doc_number ?? "",
        recurrence,
        recurrenceLabel: RECURRENCE_LABEL[recurrence] ?? recurrence,
        // A stored next_run_date wins; without one, derive it the way the runner
        // would from the issue date.
        nextRun: inv.next_run_date ?? recurrenceNext(inv.issue_date ?? today, recurrence) ?? "",
        amount,
        perMonth: amount * (PER_MONTH[recurrence] ?? 0),
      };
    })
    .sort((a, b) => (a.nextRun || "9999").localeCompare(b.nextRun || "9999") || a.client.localeCompare(b.client));

  // "Due soon" is the next 30 days — the window a cash-flow question asks about.
  // Local-date arithmetic (addDays), not new Date()+toISOString which lands a day
  // early in UTC+2 and would drop a run billing exactly 30 days out.
  const horizonStr = addDays(today, 30);

  return {
    rows,
    totals: {
      count: rows.length,
      perMonth: rows.reduce((s, r) => s + r.perMonth, 0),
      dueSoon: rows.filter((r) => r.nextRun && r.nextRun <= horizonStr).reduce((s, r) => s + r.amount, 0),
    },
  };
}
