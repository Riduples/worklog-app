import { describe, expect, it } from "vitest";
import { aggregateDirectory, aggregateDormant, aggregateMissingDetails, aggregatePayers } from "./contactsReports";
import type { Contact } from "@/lib/supabase/hooks/useContacts";
import type { Invoice } from "@/lib/supabase/hooks/useInvoices";
import type { Quote } from "@/lib/supabase/hooks/useQuotes";
import type { Booking } from "@/lib/supabase/hooks/useBookings";

const contact = (c: Partial<Contact>): Contact =>
  ({
    id: "c1",
    name: "Acme",
    contact_type: "client",
    phone: "0821234567",
    email: "acme@example.com",
    address: "12 Main St",
    payment_behaviour: "Good payer",
    payment_terms: null,
    bank_name: null,
    account_number: null,
    ...c,
  }) as Contact;

const invoice = (i: Partial<Invoice>): Invoice =>
  ({
    id: "i1",
    client_name: "Acme",
    client_contact_id: null,
    issue_date: "2026-05-01",
    paid_date: null,
    due_date: null,
    status: "unpaid",
    invoice_amount: 0,
    vat_amount: 0,
    balance_due: 0,
    ...i,
  }) as Invoice;

const quote = (q: Partial<Quote>): Quote => ({ id: "q1", client_name: "Acme", client_contact_id: null, issue_date: "2026-05-01", ...q }) as Quote;
const booking = (b: Partial<Booking>): Booking => ({ id: "b1", client_name: "Acme", client_contact_id: null, booking_date: "2026-05-01", ...b }) as Booking;

describe("aggregateDirectory", () => {
  it("splits customers from suppliers and shows the right payment note for each", () => {
    const { rows, totals } = aggregateDirectory([
      contact({ id: "1", name: "Acme", payment_behaviour: "Slow payer" }),
      contact({ id: "2", name: "Bolts Ltd", contact_type: "supplier", payment_terms: "30 days", bank_name: "FNB", account_number: "123" }),
    ]);
    expect(totals).toMatchObject({ customers: 1, suppliers: 1 });
    expect(rows.find((r) => r.name === "Acme")!.paymentNote).toBe("Slow payer");
    const supplier = rows.find((r) => r.name === "Bolts Ltd")!;
    expect(supplier.paymentNote).toBe("30 days");
    expect(supplier.bank).toBe("FNB · 123");
  });
});

describe("aggregatePayers", () => {
  const today = "2026-06-01";

  it("measures average days to pay from paid invoices only", () => {
    const { rows } = aggregatePayers(
      [contact({})],
      [
        invoice({ id: "1", issue_date: "2026-01-01", paid_date: "2026-01-11", status: "paid" }), // 10 days
        invoice({ id: "2", issue_date: "2026-02-01", paid_date: "2026-02-21", status: "paid" }), // 20 days
        invoice({ id: "3", issue_date: "2026-03-01", status: "unpaid" }),
      ],
      today
    );
    expect(rows[0].averageDays).toBe(15);
    expect(rows[0].paidInvoices).toBe(2);
    expect(rows[0].measured).toBe("Good payer");
  });

  it("says so rather than flattering a customer with no paid invoices", () => {
    const { rows, totals } = aggregatePayers([contact({})], [invoice({ status: "unpaid" })], today);
    expect(rows[0].averageDays).toBeNull();
    expect(rows[0].measured).toBe("Not enough history");
    expect(rows[0].disagrees).toBe(false);
    expect(totals.measured).toBe(0);
  });

  it("flags a record whose typed behaviour disagrees with the measurement", () => {
    const { rows, totals } = aggregatePayers(
      [contact({ payment_behaviour: "Good payer" })],
      [invoice({ issue_date: "2026-01-01", paid_date: "2026-04-01", status: "paid" })], // 90 days
      today
    );
    expect(rows[0].measured).toBe("Problem payer");
    expect(rows[0].disagrees).toBe(true);
    expect(totals.disagree).toBe(1);
  });

  it("matches invoices by contact id when there is one, and by name otherwise", () => {
    const { rows } = aggregatePayers(
      [contact({ id: "c1", name: "Acme" })],
      [
        invoice({ id: "1", client_contact_id: "c1", client_name: "Something else", issue_date: "2026-01-01", paid_date: "2026-01-11", status: "paid" }),
        invoice({ id: "2", client_contact_id: null, client_name: "acme", issue_date: "2026-01-01", paid_date: "2026-01-11", status: "paid" }),
        invoice({ id: "3", client_contact_id: "other", client_name: "Acme", issue_date: "2026-01-01", paid_date: "2026-01-31", status: "paid" }),
      ],
      today
    );
    // The third belongs to another contact by id, so it isn't counted.
    expect(rows[0].paidInvoices).toBe(2);
  });

  it("counts what is overdue and still owing", () => {
    const { rows, totals } = aggregatePayers(
      [contact({})],
      [
        invoice({ id: "1", due_date: "2026-05-01", status: "unpaid", balance_due: 500 }),
        invoice({ id: "2", due_date: "2026-07-01", status: "unpaid", balance_due: 900 }),
        invoice({ id: "3", due_date: "2026-01-01", status: "paid", balance_due: 0 }),
      ],
      today
    );
    expect(rows[0].overdueCount).toBe(1);
    expect(rows[0].overdueAmount).toBe(500);
    expect(totals.overdueAmount).toBe(500);
  });

  it("leaves suppliers out — this is the customer ledger", () => {
    const { rows } = aggregatePayers([contact({ contact_type: "supplier" })], [], today);
    expect(rows).toHaveLength(0);
  });
});

describe("aggregateDormant", () => {
  const today = "2026-06-01";

  it("lists customers with nothing in the quiet period", () => {
    const { rows, totals } = aggregateDormant(
      [contact({ id: "1", name: "Quiet" }), contact({ id: "2", name: "Busy" })],
      [invoice({ client_name: "Busy", issue_date: "2026-05-20" }), invoice({ id: "old", client_name: "Quiet", issue_date: "2025-01-01" })],
      [],
      [],
      today
    );
    expect(rows.map((r) => r.name)).toEqual(["Quiet"]);
    expect(rows[0].lastSeenWhat).toBe("invoice");
    expect(totals.dormant).toBe(1);
  });

  it("takes the most recent of an invoice, a quote or an appointment", () => {
    const { rows } = aggregateDormant(
      [contact({ name: "Acme" })],
      [invoice({ issue_date: "2024-01-01" })],
      [quote({ issue_date: "2026-05-25" })],
      [booking({ booking_date: "2023-01-01" })],
      today
    );
    // The quote is recent, so they aren't dormant at all.
    expect(rows).toHaveLength(0);
  });

  it("includes a customer who has never been used, marked", () => {
    const { rows, totals } = aggregateDormant([contact({ name: "Never used" })], [], [], [], today);
    expect(rows[0]).toMatchObject({ never: true, daysQuiet: null });
    expect(totals.never).toBe(1);
  });

  it("respects a different quiet period", () => {
    const customers = [contact({})];
    const invoices = [invoice({ issue_date: "2026-03-01" })];
    expect(aggregateDormant(customers, invoices, [], [], today, 6).rows).toHaveLength(0);
    expect(aggregateDormant(customers, invoices, [], [], today, 1).rows).toHaveLength(1);
  });
});

describe("aggregateMissingDetails", () => {
  it("lists only contacts with something missing", () => {
    const { rows, totals } = aggregateMissingDetails([contact({ id: "1", name: "Complete" }), contact({ id: "2", name: "No phone", phone: null })]);
    expect(rows.map((r) => r.name)).toEqual(["No phone"]);
    expect(rows[0].missing).toEqual(["phone"]);
    expect(totals).toMatchObject({ contacts: 2, incomplete: 1 });
  });

  it("treats a missing email as blocking — a statement can't be sent without one", () => {
    const { rows, totals } = aggregateMissingDetails([contact({ email: null })]);
    expect(rows[0].blocking).toBe(true);
    expect(totals.blocking).toBe(1);
  });

  it("wants banking details from a supplier and payment behaviour from a customer", () => {
    const supplier = aggregateMissingDetails([contact({ contact_type: "supplier", payment_terms: "30 days" })]).rows[0];
    expect(supplier.missing).toContain("banking details");
    expect(supplier.blocking).toBe(true);

    const customer = aggregateMissingDetails([contact({ payment_behaviour: null })]).rows[0];
    expect(customer.missing).toContain("payment behaviour");
    expect(customer.blocking).toBe(false);
  });

  it("puts the blocking records first", () => {
    const { rows } = aggregateMissingDetails([
      contact({ id: "1", name: "Just untidy", address: null }),
      contact({ id: "2", name: "Blocked", email: null }),
    ]);
    expect(rows[0].name).toBe("Blocked");
  });
});
