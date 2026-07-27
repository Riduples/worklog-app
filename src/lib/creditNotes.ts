import type { Tables } from "@/lib/types/database";

export type CreditNote = Tables<"credit_notes">;

/** Round to 2 decimals (cents), avoiding binary-float drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * The VAT portion contained WITHIN a VAT-inclusive credit amount. A credit note
 * mirrors the invoice it reverses, so for a VAT-registered business the credit
 * amount is inclusive and the VAT is backed out of it: amount − amount/(1+rate).
 * A non-VAT business (or a zero rate) carries no VAT.
 */
export function creditVatWithin(amount: number, vatRate: number, hasVat: boolean): number {
  if (!hasVat || !vatRate || vatRate <= 0) return 0;
  return round2(amount - amount / (1 + vatRate));
}

/**
 * How much of a freshly-raised credit sits on account (owed back to the customer
 * / owed to you by the supplier). "account" holds the whole credit; "reduce"
 * applies it against the invoice balance and only the overflow beyond that
 * balance spills onto the account.
 */
export function initialOnAccount(
  amount: number,
  balanceOwing: number,
  settlement: "reduce" | "account"
): number {
  return settlement === "account" ? round2(amount) : Math.max(0, round2(amount - balanceOwing));
}

/**
 * Status a credit note starts in. It is on account whenever any amount remains
 * owed back — the whole credit (settlement "account"), or the overflow of a
 * "reduce" credit that exceeded the balance owing. Otherwise it was fully
 * applied against the invoice.
 */
export function initialStatus(onAccountBalance: number): "on_account" | "applied" {
  return onAccountBalance > 0 ? "on_account" : "applied";
}

// ── Netting selectors ──
// Each operates on an already-filtered array (by period / contact) so callers
// keep control of the window; the credit-note math stays in one place.

/**
 * Total credit-note value on a ledger side. A credit note reduces revenue
 * (customer) / cost (supplier) the moment it is raised, regardless of how it was
 * later settled — so this counts every credit on the side, not just on-account.
 */
export function sumCredits(cns: CreditNote[], ledger: "customer" | "supplier"): number {
  return round2(
    cns.filter((c) => c.ledger === ledger).reduce((s, c) => s + Number(c.amount || 0), 0)
  );
}

/** Total VAT reversed on a ledger side (reduces output VAT / input VAT). */
export function sumCreditVat(cns: CreditNote[], ledger: "customer" | "supplier"): number {
  return round2(
    cns.filter((c) => c.ledger === ledger).reduce((s, c) => s + Number(c.vat_amount || 0), 0)
  );
}

/**
 * On-account balance still owed on a ledger side — only credits still in the
 * "on_account" state (applied / refunded ones are settled). Customer on-account
 * is owed BACK to customers (a liability that nets down "owed to you"); supplier
 * on-account is owed TO you (nets down "you owe suppliers").
 */
export function sumOnAccount(cns: CreditNote[], ledger: "customer" | "supplier"): number {
  return round2(
    cns
      .filter((c) => c.ledger === ledger && c.status === "on_account")
      .reduce((s, c) => s + Number(c.on_account_balance ?? c.amount ?? 0), 0)
  );
}

/** Total already credited against one customer invoice (guards over-crediting). */
export function creditedAgainstInvoice(cns: CreditNote[], invoiceId: string): number {
  return round2(
    cns
      .filter((c) => c.invoice_id === invoiceId)
      .reduce((s, c) => s + Number(c.amount || 0), 0)
  );
}

/** Total already credited against one supplier invoice. */
export function creditedAgainstSupplierInvoice(cns: CreditNote[], supplierInvoiceId: string): number {
  return round2(
    cns
      .filter((c) => c.supplier_invoice_id === supplierInvoiceId)
      .reduce((s, c) => s + Number(c.amount || 0), 0)
  );
}
