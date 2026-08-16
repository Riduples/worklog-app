// The four Contacts Reports, rolled up.
//
// Money per customer lives in Sales Reports and money per supplier in Purchases
// Reports, so this tool stays about the people: who they are, whether they pay
// when they say they do, who has gone quiet, and whose record is too thin to
// send a statement or a remittance to.

import type { Contact } from "@/lib/supabase/hooks/useContacts";
import type { Invoice } from "@/lib/supabase/hooks/useInvoices";
import type { Quote } from "@/lib/supabase/hooks/useQuotes";
import type { Booking } from "@/lib/supabase/hooks/useBookings";

const text = (v: unknown) => String(v ?? "").trim();

/** Contacts carry a name but a document may only carry the name it was typed with. */
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const matchesContact = (c: Contact, doc: { client_contact_id?: string | null; client_name?: string | null }) =>
  doc.client_contact_id ? doc.client_contact_id === c.id : sameName(c.name, doc.client_name ?? "");

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

// ── Directory ────────────────────────────────────────────────────────────────

export type DirectoryRow = {
  id: string;
  name: string;
  type: "client" | "supplier";
  typeLabel: string;
  phone: string;
  email: string;
  address: string;
  /** Payment behaviour for a customer, payment terms for a supplier. */
  paymentNote: string;
  bank: string;
};

export function aggregateDirectory(contacts: Contact[]): { rows: DirectoryRow[]; totals: { customers: number; suppliers: number } } {
  const rows: DirectoryRow[] = contacts
    .map((c) => {
      const type = c.contact_type === "supplier" ? ("supplier" as const) : ("client" as const);
      return {
        id: c.id,
        name: c.name,
        type,
        typeLabel: type === "supplier" ? "Supplier" : "Customer",
        phone: text(c.phone),
        email: text(c.email),
        address: text(c.address),
        paymentNote: type === "supplier" ? text(c.payment_terms) : text(c.payment_behaviour),
        bank: [text(c.bank_name), text(c.account_number)].filter(Boolean).join(" · "),
      };
    })
    .sort((a, b) => a.typeLabel.localeCompare(b.typeLabel) || a.name.localeCompare(b.name));

  return {
    rows,
    totals: {
      customers: rows.filter((r) => r.type === "client").length,
      suppliers: rows.filter((r) => r.type === "supplier").length,
    },
  };
}

// ── Who actually pays late ───────────────────────────────────────────────────

export type PayerRow = {
  id: string;
  name: string;
  /** What someone typed on the customer record. */
  behaviour: string;
  /** Measured from the invoices they have actually settled. */
  averageDays: number | null;
  paidInvoices: number;
  /** Invoices still owing and past their due date. */
  overdueCount: number;
  overdueAmount: number;
  /** The label the measured average earns, whatever the record claims. */
  measured: string;
  /** The typed behaviour and the measurement disagree. */
  disagrees: boolean;
};

// A measured verdict from average days to pay. The bands match the three
// behaviours the customer form offers, so the two can be compared at all.
function measuredLabel(averageDays: number | null): string {
  if (averageDays == null) return "Not enough history";
  if (averageDays <= 30) return "Good payer";
  if (averageDays <= 60) return "Slow payer";
  return "Problem payer";
}

/**
 * The payment behaviour someone typed, against how they actually pay.
 *
 * The average is over invoices that have been paid, measured from issue date to
 * paid date. An invoice with no paid_date can't be measured, and a customer with
 * none at all gets "not enough history" rather than a flattering zero.
 */
export function aggregatePayers(
  contacts: Contact[],
  invoices: Invoice[],
  today: string
): { rows: PayerRow[]; totals: { customers: number; measured: number; disagree: number; overdueAmount: number } } {
  const rows: PayerRow[] = contacts
    .filter((c) => c.contact_type !== "supplier")
    .map((c) => {
      const mine = invoices.filter((inv) => matchesContact(c, inv));
      const paid = mine.filter((inv) => inv.status === "paid" && inv.paid_date && inv.issue_date);
      const averageDays = paid.length
        ? paid.reduce((s, inv) => s + Math.max(0, daysBetween(inv.issue_date as string, inv.paid_date as string)), 0) / paid.length
        : null;
      const overdue = mine.filter((inv) => inv.status !== "paid" && inv.status !== "credited" && inv.due_date && inv.due_date < today);
      const behaviour = text(c.payment_behaviour);
      const measured = measuredLabel(averageDays);
      return {
        id: c.id,
        name: c.name,
        behaviour,
        averageDays,
        paidInvoices: paid.length,
        overdueCount: overdue.length,
        overdueAmount: overdue.reduce((s, inv) => s + Number(inv.balance_due || Number(inv.invoice_amount || 0) + Number(inv.vat_amount || 0)), 0),
        measured,
        // Only a disagreement when both sides have something to say.
        disagrees: !!behaviour && averageDays != null && behaviour !== measured,
      };
    })
    // Slowest payers first — the report exists to surface them.
    .sort((a, b) => (b.averageDays ?? -1) - (a.averageDays ?? -1) || a.name.localeCompare(b.name));

  return {
    rows,
    totals: {
      customers: rows.length,
      measured: rows.filter((r) => r.averageDays != null).length,
      disagree: rows.filter((r) => r.disagrees).length,
      overdueAmount: rows.reduce((s, r) => s + r.overdueAmount, 0),
    },
  };
}

// ── Dormant customers ────────────────────────────────────────────────────────

export type DormantRow = {
  id: string;
  name: string;
  phone: string;
  /** The most recent invoice, quote or booking — whichever is latest. */
  lastSeen: string;
  lastSeenWhat: string;
  daysQuiet: number | null;
  /** Never invoiced, quoted or booked at all. */
  never: boolean;
};

/**
 * Customers nobody has invoiced, quoted or booked in a while.
 *
 * `months` is the quiet period. Contacts with no activity at all are included
 * and marked — a customer captured and never used is worth a call too.
 */
export function aggregateDormant(
  contacts: Contact[],
  invoices: Invoice[],
  quotes: Quote[],
  bookings: Booking[],
  today: string,
  months = 6
): { rows: DormantRow[]; totals: { dormant: number; never: number; customers: number } } {
  const cutoff = new Date(`${today}T00:00:00`);
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const customers = contacts.filter((c) => c.contact_type !== "supplier");

  const rows: DormantRow[] = customers
    .map((c) => {
      const seen: { date: string; what: string }[] = [
        ...invoices.filter((inv) => matchesContact(c, inv)).map((inv) => ({ date: inv.issue_date ?? "", what: "invoice" })),
        ...quotes.filter((q) => matchesContact(c, q)).map((q) => ({ date: q.issue_date ?? "", what: "quote" })),
        ...bookings.filter((b) => matchesContact(c, b)).map((b) => ({ date: b.booking_date ?? "", what: "appointment" })),
      ].filter((s) => s.date);

      const latest = seen.sort((a, b) => b.date.localeCompare(a.date))[0];
      return {
        id: c.id,
        name: c.name,
        phone: text(c.phone),
        lastSeen: latest?.date ?? "",
        lastSeenWhat: latest?.what ?? "",
        daysQuiet: latest ? daysBetween(latest.date, today) : null,
        never: !latest,
      };
    })
    .filter((r) => r.never || r.lastSeen < cutoffStr)
    // Quiet longest first; the never-used sit at the end, where a call is a
    // different kind of conversation.
    .sort((a, b) => Number(a.never) - Number(b.never) || (b.daysQuiet ?? 0) - (a.daysQuiet ?? 0) || a.name.localeCompare(b.name));

  return {
    rows,
    totals: {
      dormant: rows.filter((r) => !r.never).length,
      never: rows.filter((r) => r.never).length,
      customers: customers.length,
    },
  };
}

// ── Missing details ──────────────────────────────────────────────────────────

export type MissingRow = {
  id: string;
  name: string;
  type: "client" | "supplier";
  typeLabel: string;
  missing: string[];
  /** Missing something that actually stops a document going out. */
  blocking: boolean;
};

/**
 * Whose record is too thin.
 *
 * What counts as missing depends on the side: a customer with no email can't be
 * sent a statement, and a supplier with no banking details can't be paid off a
 * remittance. Those are the blocking ones; a missing address is untidy rather
 * than fatal.
 */
export function aggregateMissingDetails(contacts: Contact[]): { rows: MissingRow[]; totals: { contacts: number; incomplete: number; blocking: number } } {
  const rows: MissingRow[] = contacts
    .map((c) => {
      const isSupplier = c.contact_type === "supplier";
      const missing: string[] = [];
      let blocking = false;

      if (!text(c.phone)) missing.push("phone");
      if (!text(c.email)) {
        missing.push("email");
        // A statement or a remittance goes out by email.
        blocking = true;
      }
      if (!text(c.address)) missing.push("address");
      if (isSupplier && !text(c.bank_name) && !text(c.account_number)) {
        missing.push("banking details");
        blocking = true;
      }
      if (!isSupplier && !text(c.payment_behaviour)) missing.push("payment behaviour");
      if (isSupplier && !text(c.payment_terms)) missing.push("payment terms");

      return {
        id: c.id,
        name: c.name,
        type: isSupplier ? ("supplier" as const) : ("client" as const),
        typeLabel: isSupplier ? "Supplier" : "Customer",
        missing,
        blocking,
      };
    })
    .filter((r) => r.missing.length > 0)
    .sort((a, b) => Number(b.blocking) - Number(a.blocking) || b.missing.length - a.missing.length || a.name.localeCompare(b.name));

  return {
    rows,
    totals: {
      contacts: contacts.length,
      incomplete: rows.length,
      blocking: rows.filter((r) => r.blocking).length,
    },
  };
}
