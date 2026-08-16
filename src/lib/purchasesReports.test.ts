import { describe, expect, it } from "vitest";
import { aggregateBillsDue, aggregateCategorySpend, aggregateCommitted, aggregateSupplierSpend } from "./purchasesReports";
import type { SupplierInvoice } from "@/lib/supabase/hooks/useSupplierInvoices";
import type { PurchaseOrder } from "@/lib/supabase/hooks/usePurchaseOrders";
import type { Expense } from "@/lib/supabase/hooks/useExpenses";
import type { Contact } from "@/lib/supabase/hooks/useContacts";

const always = () => true;

const si = (s: Partial<SupplierInvoice>): SupplierInvoice =>
  ({
    id: "si1",
    supplier_name: "John's Hardware",
    doc_number: "SI-1",
    supplier_ref_number: null,
    issue_date: "2026-05-01",
    due_date: null,
    invoice_amount: 0,
    vat_amount: 0,
    balance_due: 0,
    status: "unpaid",
    linked_po_id: null,
    ...s,
  }) as SupplierInvoice;

const po = (p: Partial<PurchaseOrder>): PurchaseOrder =>
  ({ id: "po1", supplier_name: "John's Hardware", doc_number: "PO-1", issue_date: "2026-05-01", requested_delivery: null, status: "pending", total_amount: 0, vat_amount: 0, ...p }) as PurchaseOrder;

const expense = (e: Partial<Expense>): Expense =>
  ({ id: "e1", amount: 0, paid_to: "John's Hardware", transaction_date: "2026-05-05", sars_category: "Materials", is_personal: false, is_credit_settlement: false, source: null, ...e }) as Expense;

const contact = (c: Partial<Contact>): Contact =>
  ({ id: "c1", name: "John's Hardware", contact_type: "supplier", payment_terms: "30 days", ...c }) as Contact;

describe("aggregateSupplierSpend", () => {
  it("keeps billed and paid apart rather than adding them", () => {
    const { rows, totals } = aggregateSupplierSpend(
      [si({ invoice_amount: 1000, vat_amount: 150, balance_due: 1150 })],
      [expense({ amount: 400 })],
      [contact({})],
      always
    );
    expect(rows[0]).toMatchObject({ billed: 1150, paid: 400, outstanding: 1150, invoices: 1, terms: "30 days" });
    expect(totals).toMatchObject({ suppliers: 1, billed: 1150, paid: 400 });
  });

  it("leaves out personal spend and payroll expenses", () => {
    const { totals } = aggregateSupplierSpend(
      [],
      [expense({ id: "1", amount: 100, is_personal: true }), expense({ id: "2", amount: 200, source: "payroll" }), expense({ id: "3", amount: 50 })],
      [],
      always
    );
    expect(totals.paid).toBe(50);
  });

  it("leaves out credit-note settlements (a customer refund is not supplier spend)", () => {
    const { totals } = aggregateSupplierSpend(
      [],
      [expense({ id: "1", amount: 1000, is_credit_settlement: true, paid_to: "A Customer" }), expense({ id: "2", amount: 50 })],
      [],
      always
    );
    expect(totals.paid).toBe(50);
  });

  it("reconciles billed and paid for one supplier despite name casing", () => {
    const { rows, totals } = aggregateSupplierSpend(
      [si({ supplier_name: "ACME", invoice_amount: 1000, vat_amount: 0, balance_due: 1000 })],
      [expense({ paid_to: "acme", amount: 400 })],
      [],
      always
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ billed: 1000, paid: 400 });
    expect(totals.suppliers).toBe(1);
  });

  it("ranks by the larger of what was billed or paid", () => {
    const { rows } = aggregateSupplierSpend(
      [si({ supplier_name: "Billed big", invoice_amount: 5000 })],
      [expense({ paid_to: "Paid bigger", amount: 9000 })],
      [],
      always
    );
    expect(rows[0].name).toBe("Paid bigger");
  });

  it("respects the period filter", () => {
    const { totals } = aggregateSupplierSpend(
      [si({ issue_date: "2020-01-01", invoice_amount: 999 })],
      [expense({ transaction_date: "2026-05-05", amount: 100 })],
      [],
      (d) => d.startsWith("2026")
    );
    expect(totals.billed).toBe(0);
    expect(totals.paid).toBe(100);
  });
});

describe("aggregateCategorySpend", () => {
  it("totals every category with its share, biggest first", () => {
    const { rows, totals } = aggregateCategorySpend(
      [
        expense({ id: "1", sars_category: "Materials", amount: 700 }),
        expense({ id: "2", sars_category: "Fuel", amount: 300 }),
        expense({ id: "3", sars_category: "Materials", amount: 0 }),
      ],
      always
    );
    expect(rows[0]).toMatchObject({ category: "Materials", amount: 700, count: 2, sharePct: 70 });
    expect(totals).toMatchObject({ total: 1000, count: 3, categories: 2 });
  });

  it("gathers spend with no category under Uncategorised and reports it", () => {
    const { totals } = aggregateCategorySpend([expense({ sars_category: null, amount: 250 })], always);
    expect(totals.uncategorised).toBe(250);
  });

  it("excludes personal spend and credit settlements", () => {
    const { totals } = aggregateCategorySpend(
      [expense({ id: "1", amount: 100, is_personal: true }), expense({ id: "2", amount: 200, is_credit_settlement: true }), expense({ id: "3", amount: 30 })],
      always
    );
    expect(totals.total).toBe(30);
  });
});

describe("aggregateCommitted", () => {
  const today = "2026-06-01";

  it("drops an order once a supplier invoice links back to it", () => {
    const { totals } = aggregateCommitted(
      [po({ id: "po1", total_amount: 1000 }), po({ id: "po2", total_amount: 500 })],
      [si({ linked_po_id: "po1" })],
      today
    );
    expect(totals.orders).toBe(1);
    expect(totals.amount).toBe(500);
  });

  it("leaves out cancelled and fulfilled orders", () => {
    const { totals } = aggregateCommitted(
      [po({ id: "1", status: "cancelled", total_amount: 900 }), po({ id: "2", status: "fulfilled", total_amount: 900 }), po({ id: "3", status: "pending", total_amount: 100 })],
      [],
      today
    );
    expect(totals.amount).toBe(100);
  });

  it("counts VAT into the commitment and ages from the issue date", () => {
    const { rows } = aggregateCommitted([po({ issue_date: "2026-05-02", total_amount: 1000, vat_amount: 150 })], [], today);
    expect(rows[0].amount).toBe(1150);
    expect(rows[0].ageDays).toBe(30);
  });

  it("flags orders past their requested delivery", () => {
    const { totals } = aggregateCommitted(
      [po({ id: "1", requested_delivery: "2026-05-01", total_amount: 400 }), po({ id: "2", requested_delivery: "2026-07-01", total_amount: 100 })],
      [],
      today
    );
    expect(totals.overdue).toBe(1);
    expect(totals.overdueAmount).toBe(400);
  });
});

describe("aggregateBillsDue", () => {
  const today = "2026-06-01";

  it("buckets what is owed by when it falls due", () => {
    const { totals } = aggregateBillsDue(
      [
        si({ id: "1", due_date: "2026-05-20", balance_due: 100 }),
        si({ id: "2", due_date: "2026-06-05", balance_due: 200 }),
        si({ id: "3", due_date: "2026-06-20", balance_due: 300 }),
        si({ id: "4", due_date: "2026-09-01", balance_due: 400 }),
        si({ id: "5", due_date: null, balance_due: 500 }),
      ],
      today
    );
    expect(totals).toMatchObject({ overdue: 100, week: 200, month: 300, later: 400, undated: 500, total: 1500, count: 5 });
  });

  it("ignores bills with nothing left to pay", () => {
    const { totals } = aggregateBillsDue(
      [
        si({ id: "1", status: "paid", balance_due: 0 }),
        si({ id: "2", status: "credited", balance_due: 900 }),
        si({ id: "3", status: "unpaid", balance_due: 50, due_date: "2026-06-02" }),
      ],
      today
    );
    expect(totals.count).toBe(1);
    expect(totals.total).toBe(50);
  });

  it("orders by due date, soonest first, with undated last", () => {
    const { rows } = aggregateBillsDue(
      [si({ id: "1", due_date: null, balance_due: 10 }), si({ id: "2", due_date: "2026-06-10", balance_due: 10 }), si({ id: "3", due_date: "2026-06-02", balance_due: 10 })],
      today
    );
    expect(rows.map((r) => r.id)).toEqual(["3", "2", "1"]);
  });
});
