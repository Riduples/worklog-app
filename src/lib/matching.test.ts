import { describe, expect, it } from "vitest";
import { expenseSettlesEntry, ledgerEntryOutstanding } from "@/components/ui/LedgerEntryMatcher";
import { paymentSettlesInvoice, invoiceBalanceInclVat } from "@/components/ui/InvoiceMatcher";
import { expenseSettlesSupplierInvoice, supplierInvoiceOutstanding } from "@/components/ui/SupplierInvoiceMatcher";
import type { LedgerEntry } from "@/lib/supabase/hooks/useLedger";
import type { Invoice } from "@/lib/supabase/hooks/useInvoices";
import type { SupplierInvoice } from "@/lib/supabase/hooks/useSupplierInvoices";

// Both matchers decide the same thing from opposite ends: has this money fully
// settled the thing it points at, and may we therefore write status='paid'.
// Getting it wrong marks a debt settled that isn't, which nobody notices until
// year end. The income half has been making that call since 3885cf2 with no
// test at all; adding its twin was the moment to cover both.
//
// Only the fields these functions read — the rest of the row is noise here.
const entry = (over: Partial<LedgerEntry> = {}) =>
  ({ id: "e1", ledger_type: "supplier", party_name: "Pipe Co", amount: 1000, status: "unpaid", ...over }) as LedgerEntry;

const invoice = (over: Partial<Invoice> = {}) =>
  ({ id: "i1", doc_number: "INV-1", client_name: "Sarah", invoice_amount: 1000, vat_amount: 150, balance_due: 1000, status: "unpaid", ...over }) as Invoice;

const supplierInvoice = (over: Partial<SupplierInvoice> = {}) =>
  ({ id: "si1", supplier_name: "Supabase", invoice_amount: 1000, vat_amount: 150, balance_due: 1000, status: "unpaid", ...over }) as SupplierInvoice;

describe("ledgerEntryOutstanding", () => {
  it("is the full amount while unpaid — entries have no amount-paid column", () => {
    expect(ledgerEntryOutstanding(entry({ amount: 1000 }))).toBe(1000);
  });

  it("is nothing once paid", () => {
    expect(ledgerEntryOutstanding(entry({ status: "paid" }))).toBe(0);
  });

  it("still shows the full amount when partial, rather than inventing a figure", () => {
    // 'partial' is a valid status but no column records how much was paid, so
    // any smaller number here would be a guess about someone's books.
    expect(ledgerEntryOutstanding(entry({ status: "partial", amount: 1000 }))).toBe(1000);
  });
});

describe("expenseSettlesEntry", () => {
  it("settles when the expense covers what is owed", () => {
    expect(expenseSettlesEntry(entry({ amount: 1000 }), 1000)).toBe(true);
  });

  it("settles when it more than covers it", () => {
    expect(expenseSettlesEntry(entry({ amount: 1000 }), 1200)).toBe(true);
  });

  it("does not settle a part payment", () => {
    expect(expenseSettlesEntry(entry({ amount: 1000 }), 999)).toBe(false);
  });

  it("forgives a cent, so float noise never blocks a settled debt", () => {
    expect(expenseSettlesEntry(entry({ amount: 1000 }), 999.995)).toBe(true);
  });

  it("refuses an entry that is already paid", () => {
    expect(expenseSettlesEntry(entry({ status: "paid" }), 5000)).toBe(false);
  });

  it("refuses a zero or negative expense", () => {
    expect(expenseSettlesEntry(entry(), 0)).toBe(false);
    expect(expenseSettlesEntry(entry(), -100)).toBe(false);
  });

  it("refuses when nothing is matched", () => {
    expect(expenseSettlesEntry(null, 1000)).toBe(false);
    expect(expenseSettlesEntry(undefined, 1000)).toBe(false);
  });
});

describe("invoiceBalanceInclVat", () => {
  it("adds VAT to what is still owed, because the customer pays gross", () => {
    expect(invoiceBalanceInclVat(invoice({ balance_due: 1000, vat_amount: 150 }))).toBe(1150);
  });

  it("is nothing once the balance is cleared, VAT included", () => {
    // balance_due is ex-VAT and zero when paid; adding vat_amount to zero would
    // claim the VAT is still outstanding.
    expect(invoiceBalanceInclVat(invoice({ balance_due: 0, vat_amount: 150 }))).toBe(0);
  });

  it("copes with an invoice carrying no VAT", () => {
    expect(invoiceBalanceInclVat(invoice({ balance_due: 500, vat_amount: null }))).toBe(500);
  });
});

describe("paymentSettlesInvoice", () => {
  it("settles when the gross payment covers the gross balance", () => {
    expect(paymentSettlesInvoice(invoice({ balance_due: 1000, vat_amount: 150 }), 1150)).toBe(true);
  });

  it("does not settle when the payment only covers the ex-VAT amount", () => {
    // The trap: 1000 looks like the whole invoice_amount, but the customer owes
    // 1150. Marking this paid would write off the VAT.
    expect(paymentSettlesInvoice(invoice({ balance_due: 1000, vat_amount: 150 }), 1000)).toBe(false);
  });

  it("forgives a cent", () => {
    expect(paymentSettlesInvoice(invoice({ balance_due: 1000, vat_amount: 150 }), 1149.995)).toBe(true);
  });

  it("refuses an invoice already paid", () => {
    expect(paymentSettlesInvoice(invoice({ status: "paid" }), 99999)).toBe(false);
  });

  it("refuses a zero payment and an unmatched invoice", () => {
    expect(paymentSettlesInvoice(invoice(), 0)).toBe(false);
    expect(paymentSettlesInvoice(null, 1150)).toBe(false);
  });
});

// A supplier invoice is the purchase-side mirror of a customer invoice: it
// carries VAT, so what you owe is the incl-VAT balance and the same ex-VAT trap
// applies from the other direction.
describe("supplierInvoiceOutstanding", () => {
  it("adds VAT to what is still owed, because you pay the supplier gross", () => {
    expect(supplierInvoiceOutstanding(supplierInvoice({ balance_due: 1000, vat_amount: 150 }))).toBe(1150);
  });

  it("is nothing once the balance is cleared, VAT included", () => {
    expect(supplierInvoiceOutstanding(supplierInvoice({ balance_due: 0, vat_amount: 150 }))).toBe(0);
  });

  it("copes with a bill carrying no VAT", () => {
    expect(supplierInvoiceOutstanding(supplierInvoice({ balance_due: 500, vat_amount: null }))).toBe(500);
  });
});

describe("expenseSettlesSupplierInvoice", () => {
  it("settles when the gross expense covers the gross balance", () => {
    expect(expenseSettlesSupplierInvoice(supplierInvoice({ balance_due: 1000, vat_amount: 150 }), 1150)).toBe(true);
  });

  it("does not settle when the expense only covers the ex-VAT amount", () => {
    // The mirror of the invoice trap: 1000 looks like invoice_amount, but you
    // owe 1150. Marking it paid would write off the input VAT.
    expect(expenseSettlesSupplierInvoice(supplierInvoice({ balance_due: 1000, vat_amount: 150 }), 1000)).toBe(false);
  });

  it("forgives a cent", () => {
    expect(expenseSettlesSupplierInvoice(supplierInvoice({ balance_due: 1000, vat_amount: 150 }), 1149.995)).toBe(true);
  });

  it("refuses a bill already paid", () => {
    expect(expenseSettlesSupplierInvoice(supplierInvoice({ status: "paid" }), 99999)).toBe(false);
  });

  it("refuses a zero expense and an unmatched bill", () => {
    expect(expenseSettlesSupplierInvoice(supplierInvoice(), 0)).toBe(false);
    expect(expenseSettlesSupplierInvoice(null, 1150)).toBe(false);
  });
});

describe("the two halves agree", () => {
  // They are mirrors: same rule, opposite direction. If one grows a cent of
  // tolerance or loses it, this notices.
  it("both forgive exactly one cent and no more", () => {
    expect(expenseSettlesEntry(entry({ amount: 1000 }), 999.99)).toBe(true);
    expect(expenseSettlesEntry(entry({ amount: 1000 }), 999.98)).toBe(false);
    expect(paymentSettlesInvoice(invoice({ balance_due: 1000, vat_amount: 0 }), 999.99)).toBe(true);
    expect(paymentSettlesInvoice(invoice({ balance_due: 1000, vat_amount: 0 }), 999.98)).toBe(false);
  });

  it("customer and supplier invoices settle by the same incl-VAT rule", () => {
    expect(paymentSettlesInvoice(invoice({ balance_due: 1000, vat_amount: 150 }), 1150)).toBe(true);
    expect(expenseSettlesSupplierInvoice(supplierInvoice({ balance_due: 1000, vat_amount: 150 }), 1150)).toBe(true);
  });
});
