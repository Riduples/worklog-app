import { incomeNet } from "@/lib/taxRates";

type SupplyType = "standard" | "zero_rated" | "exempt";

// Structural shapes rather than the full DB Row types: only the fields the
// turnover split reads, so a test can pass plain literals (as incomeNet does).
type InvoiceRow = {
  id: string;
  issue_date: string;
  invoice_amount?: number | string | null;
  vat_supply_type?: string | null;
};

type IncomeRow = {
  amount: number | string;
  vat_amount?: number | string | null;
  transaction_date: string;
  matched_invoice_id?: string | null;
  is_personal?: boolean | null;
  is_credit_settlement?: boolean | null;
  vat_supply_type?: string | null;
};

type CreditNoteRow = {
  ledger: string;
  issue_date: string;
  invoice_id?: string | null;
  amount?: number | string | null;
  vat_amount?: number | string | null;
};

export type Supplies = {
  standard: number;
  zero_rated: number;
  exempt: number;
  total: number;
};

// A supply type is standard unless it is explicitly one of the other two — the
// same default the invoice/income filters use ((vat_supply_type ?? "standard")).
const supplyOf = (t: string | null | undefined): SupplyType =>
  t === "zero_rated" || t === "exempt" ? t : "standard";

/**
 * Turnover split by VAT supply type for VAT201 fields 1 (standard), 2 (zero-
 * rated) and 3 (exempt) — all ex-VAT and net of customer credit notes.
 *
 * Invoices carry an ex-VAT invoice_amount; cash sales are gross so take
 * incomeNet (zero-rated / exempt rows hold no VAT, so incomeNet == amount for
 * them). Owner's-own-money rows (is_personal) aren't supplies, and payments that
 * only settle an invoice already counted (matched_invoice_id) are excluded.
 *
 * A customer credit note reverses part of a sale, so it reduces the supply value
 * in the SAME bucket as the invoice it was raised against — a credited zero-rated
 * sale comes off field 2, not field 1. That bucket is read from the invoice's
 * vat_supply_type via the credit's invoice_id link (every customer credit note
 * carries one; a credit whose invoice can't be resolved falls back to standard).
 * Credits net in the period of their own issue_date, exactly as the output-VAT
 * figure already nets them, so the declared supply values and the VAT stay
 * consistent instead of the supplies being left gross while the VAT is net.
 */
export function suppliesByType(
  invoices: InvoiceRow[],
  income: IncomeRow[],
  creditNotes: CreditNoteRow[],
  fromDate: string,
  toDate: string
): Supplies {
  const totals: Record<SupplyType, number> = { standard: 0, zero_rated: 0, exempt: 0 };

  for (const r of invoices) {
    if (r.issue_date < fromDate || r.issue_date > toDate) continue;
    totals[supplyOf(r.vat_supply_type)] += Number(r.invoice_amount ?? 0);
  }

  for (const r of income) {
    // is_credit_settlement rows are money received to settle a credit-book entry
    // (e.g. a supplier refund), not a sale — exclude them exactly as pnl.ts does,
    // or they inflate standard-rated turnover.
    if (r.matched_invoice_id || r.is_personal || r.is_credit_settlement) continue;
    if (r.transaction_date < fromDate || r.transaction_date > toDate) continue;
    totals[supplyOf(r.vat_supply_type)] += incomeNet(r);
  }

  // The invoice a credit reverses may sit outside the period, so map supply type
  // over every invoice, not just the period's.
  const supplyByInvoiceId = new Map<string, SupplyType>();
  for (const r of invoices) supplyByInvoiceId.set(r.id, supplyOf(r.vat_supply_type));

  for (const c of creditNotes) {
    if (c.ledger !== "customer") continue;
    if (c.issue_date < fromDate || c.issue_date > toDate) continue;
    const bucket = (c.invoice_id ? supplyByInvoiceId.get(c.invoice_id) : undefined) ?? "standard";
    // amount is VAT-inclusive; the buckets are ex-VAT, so back the VAT out.
    totals[bucket] -= Number(c.amount ?? 0) - Number(c.vat_amount ?? 0);
  }

  return {
    standard: totals.standard,
    zero_rated: totals.zero_rated,
    exempt: totals.exempt,
    total: totals.standard + totals.zero_rated + totals.exempt,
  };
}
