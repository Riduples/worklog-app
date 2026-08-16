import { describe, expect, it } from "vitest";
import { aggregateQuoteConversion, aggregateRecurring, aggregateSalesSummary, aggregateWhatSells, quoteOutcomeOf } from "./salesReports";
import type { Invoice } from "@/lib/supabase/hooks/useInvoices";
import type { Quote } from "@/lib/supabase/hooks/useQuotes";
import type { CreditNote } from "@/lib/supabase/hooks/useCreditNotes";

const always = () => true;

const invoice = (i: Partial<Invoice>): Invoice =>
  ({
    id: "i1",
    client_name: "Acme",
    doc_number: "INV-1",
    issue_date: "2026-05-10",
    invoice_amount: 0,
    vat_amount: 0,
    deposit_received: 0,
    status: "unpaid",
    line_items: [],
    recurrence: "none",
    recurrence_parent_id: null,
    next_run_date: null,
    ...i,
  }) as Invoice;

const credit = (c: Partial<CreditNote>): CreditNote =>
  ({ id: "c1", ledger: "customer", issue_date: "2026-05-12", amount: 0, ...c }) as CreditNote;

const quote = (q: Partial<Quote>): Quote =>
  ({ id: "q1", client_name: "Acme", issue_date: "2026-05-01", total_amount: 0, status: "pending", converted_to_invoice_id: null, valid_until: null, ...q }) as Quote;

describe("aggregateSalesSummary", () => {
  it("groups by month, newest first, netting credit notes off", () => {
    const { months, totals } = aggregateSalesSummary(
      [
        invoice({ id: "1", issue_date: "2026-05-10", invoice_amount: 1000, vat_amount: 150 }),
        invoice({ id: "2", issue_date: "2026-04-02", invoice_amount: 500, vat_amount: 75 }),
      ],
      [credit({ issue_date: "2026-05-20", amount: 200 })],
      always
    );
    expect(months.map((m) => m.month)).toEqual(["2026-05", "2026-04"]);
    expect(months[0]).toMatchObject({ invoiced: 1000, vat: 150, credited: 200, net: 800 });
    expect(totals.net).toBe(1300);
  });

  it("counts a paid invoice in full and a part-paid one at its deposit", () => {
    const { totals } = aggregateSalesSummary(
      [
        invoice({ id: "1", invoice_amount: 1000, vat_amount: 150, status: "paid" }),
        invoice({ id: "2", invoice_amount: 400, vat_amount: 60, deposit_received: 100 }),
      ],
      [],
      always
    );
    expect(totals.received).toBe(1250);
    expect(totals.outstanding).toBe(360);
  });

  it("never reports negative outstanding when someone overpays", () => {
    const { totals } = aggregateSalesSummary([invoice({ invoice_amount: 100, vat_amount: 0, deposit_received: 250 })], [], always);
    expect(totals.outstanding).toBe(0);
  });

  it("ignores supplier credit notes — this is the customer ledger", () => {
    const { totals } = aggregateSalesSummary([invoice({ invoice_amount: 1000 })], [credit({ ledger: "supplier", amount: 900 })], always);
    expect(totals.credited).toBe(0);
    expect(totals.net).toBe(1000);
  });

  it("respects the period filter", () => {
    const { totals } = aggregateSalesSummary(
      [invoice({ id: "1", issue_date: "2026-05-10", invoice_amount: 1000 }), invoice({ id: "2", issue_date: "2025-01-01", invoice_amount: 999 })],
      [],
      (d) => d.startsWith("2026")
    );
    expect(totals.invoiced).toBe(1000);
  });
});

describe("quoteOutcomeOf", () => {
  const today = "2026-06-01";

  it("counts a quote converted when it has an invoice, whatever its status says", () => {
    expect(quoteOutcomeOf(quote({ status: "pending", converted_to_invoice_id: "inv1" }), today)).toBe("converted");
  });

  it("treats a quote past its valid-until as expired, not open", () => {
    expect(quoteOutcomeOf(quote({ status: "pending", valid_until: "2026-05-01" }), today)).toBe("expired");
    expect(quoteOutcomeOf(quote({ status: "pending", valid_until: "2026-07-01" }), today)).toBe("open");
  });

  it("leaves an accepted quote accepted even once it has expired", () => {
    expect(quoteOutcomeOf(quote({ status: "accepted", valid_until: "2020-01-01" }), today)).toBe("accepted");
  });
});

describe("aggregateQuoteConversion", () => {
  const today = "2026-06-01";

  it("rates wins against decided quotes, leaving open ones out of the denominator", () => {
    const { totals } = aggregateQuoteConversion(
      [
        quote({ id: "1", status: "converted", total_amount: 1000 }),
        quote({ id: "2", status: "declined", total_amount: 500 }),
        quote({ id: "3", status: "pending", total_amount: 800, valid_until: "2026-12-01" }),
      ],
      always,
      today
    );
    expect(totals.won).toBe(1);
    expect(totals.lost).toBe(1);
    expect(totals.open).toBe(1);
    expect(totals.conversionRate).toBe(50);
    expect(totals.wonValue).toBe(1000);
    expect(totals.lostValue).toBe(500);
    expect(totals.openValue).toBe(800);
  });

  it("counts an expired quote as lost", () => {
    const { totals } = aggregateQuoteConversion(
      [quote({ id: "1", status: "converted", total_amount: 100 }), quote({ id: "2", status: "pending", total_amount: 100, valid_until: "2020-01-01" })],
      always,
      today
    );
    expect(totals.conversionRate).toBe(50);
    expect(totals.lost).toBe(1);
  });

  it("has no conversion rate to report when nothing has been decided", () => {
    const { totals } = aggregateQuoteConversion([quote({ status: "pending", valid_until: "2026-12-01" })], always, today);
    expect(totals.conversionRate).toBe(0);
  });

  it("drops outcomes nobody has", () => {
    const { rows } = aggregateQuoteConversion([quote({ status: "converted", total_amount: 10 })], always, today);
    expect(rows.map((r) => r.outcome)).toEqual(["converted"]);
  });
});

describe("aggregateWhatSells", () => {
  it("rolls lines up by description and ranks by value", () => {
    const { rows, totals } = aggregateWhatSells(
      [
        invoice({ id: "1", line_items: [{ desc: "Call-out", qty: 1, unit_price: 350 }, { desc: "Pipe", qty: 4, unit_price: 50 }] }),
        invoice({ id: "2", line_items: [{ desc: "call-out", qty: 2, unit_price: 350 }] }),
      ],
      always
    );
    expect(rows[0]).toMatchObject({ description: "Call-out", qty: 3, value: 1050, invoices: 2 });
    expect(rows[1]).toMatchObject({ description: "Pipe", qty: 4, value: 200 });
    expect(totals).toMatchObject({ lines: 2, value: 1250 });
  });

  it("adds up the historic labour/materials line shape too", () => {
    const { rows } = aggregateWhatSells([invoice({ line_items: [{ desc: "Job", qty: 3, labour: 200, materials: 100 }] })], always);
    // qty was never multiplied in on the old shape, so it isn't here either.
    expect(rows[0].value).toBe(300);
  });

  it("skips lines with no description — there's nothing to group them by", () => {
    const { rows } = aggregateWhatSells([invoice({ line_items: [{ desc: "", unit_price: 99 }, { unit_price: 99 }] })], always);
    expect(rows).toHaveLength(0);
  });
});

describe("aggregateRecurring", () => {
  const today = "2026-05-01";

  it("states every cycle as a monthly figure so they can be added up", () => {
    const { totals } = aggregateRecurring(
      [
        invoice({ id: "1", recurrence: "monthly", invoice_amount: 1000, next_run_date: "2026-05-10" }),
        invoice({ id: "2", recurrence: "annual", invoice_amount: 1200, next_run_date: "2026-12-01" }),
        invoice({ id: "3", recurrence: "quarterly", invoice_amount: 300, next_run_date: "2026-07-01" }),
      ],
      today
    );
    expect(totals.count).toBe(3);
    expect(totals.perMonth).toBeCloseTo(1000 + 100 + 100, 5);
  });

  it("counts the parent only — a run's child invoice isn't a second commitment", () => {
    const { totals } = aggregateRecurring(
      [
        invoice({ id: "1", recurrence: "monthly", invoice_amount: 500 }),
        invoice({ id: "2", recurrence: "monthly", invoice_amount: 500, recurrence_parent_id: "1" }),
      ],
      today
    );
    expect(totals.count).toBe(1);
    expect(totals.perMonth).toBe(500);
  });

  it("leaves once-off invoices out entirely", () => {
    expect(aggregateRecurring([invoice({ recurrence: "none", invoice_amount: 900 })], today).rows).toHaveLength(0);
  });

  it("derives a next run from the issue date when none is stored", () => {
    const { rows } = aggregateRecurring([invoice({ recurrence: "monthly", issue_date: "2026-04-15", next_run_date: null })], today);
    expect(rows[0].nextRun).toBe("2026-05-15");
  });

  it("totals what bills within the next 30 days", () => {
    const { totals } = aggregateRecurring(
      [
        invoice({ id: "1", recurrence: "monthly", invoice_amount: 100, vat_amount: 15, next_run_date: "2026-05-10" }),
        invoice({ id: "2", recurrence: "monthly", invoice_amount: 900, next_run_date: "2026-09-01" }),
      ],
      today
    );
    expect(totals.dueSoon).toBe(115);
  });
});
