/**
 * What is still owed on a document, VAT included.
 *
 * The rule is one line and the app got it wrong in three places, so it lives
 * here now rather than being retyped at each call site.
 *
 * balance_due is stored EX-VAT, and marking a document paid sets it to zero
 * while leaving vat_amount alone — the VAT is a snapshot of what was charged,
 * not a running balance. So `balance_due + vat_amount` says a fully paid VAT
 * invoice still owes you the VAT. That reached customers: the WhatsApp text and
 * the PDF for a settled invoice both announced a balance of exactly the VAT.
 *
 * Nothing is outstanding once the balance is zero. Adding VAT to nothing owed
 * claims a debt that isn't there.
 *
 * Takes the two numbers rather than a row, because the callers hold three
 * different shapes — an Invoice, a SupplierInvoice, and the doc the templates
 * render — and the rule is the same for all of them.
 */
export function balanceInclVat(balanceDue: number | string | null | undefined, vatAmount: number | string | null | undefined): number {
  const balance = Number(balanceDue ?? 0);
  return balance > 0 ? balance + Number(vatAmount ?? 0) : 0;
}
