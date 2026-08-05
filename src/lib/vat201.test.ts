import { describe, expect, it } from "vitest";
import { suppliesByType } from "./vat201";

// The bug these guard: the VAT201 output-VAT figure nets customer credit notes,
// but the supply values it declares (fields 1–3) used to stay gross — so a period
// with a customer credit note over-declared its turnover. A credit reverses part
// of a sale, so it must come off the SAME supply-type bucket as the invoice it
// was raised against, in the period the credit was issued.

const FROM = "2026-07-01";
const TO = "2026-07-31";

const supplies = (
  invoices: Parameters<typeof suppliesByType>[0],
  income: Parameters<typeof suppliesByType>[1] = [],
  creditNotes: Parameters<typeof suppliesByType>[2] = []
) => suppliesByType(invoices, income, creditNotes, FROM, TO);

describe("suppliesByType — the gross split (no credit notes)", () => {
  it("buckets invoices ex-VAT by supply type, defaulting a missing type to standard", () => {
    const s = supplies([
      { id: "a", issue_date: "2026-07-10", invoice_amount: 1000, vat_supply_type: "standard" },
      { id: "b", issue_date: "2026-07-11", invoice_amount: 500, vat_supply_type: "zero_rated" },
      { id: "c", issue_date: "2026-07-12", invoice_amount: 300, vat_supply_type: "exempt" },
      { id: "d", issue_date: "2026-07-13", invoice_amount: 200, vat_supply_type: null },
    ]);
    expect(s).toEqual({ standard: 1200, zero_rated: 500, exempt: 300, total: 2000 });
  });

  it("adds cash sales at their ex-VAT value and ignores personal / invoice-settling rows", () => {
    const s = supplies(
      [],
      [
        { amount: 230, vat_amount: 30, transaction_date: "2026-07-05" }, // net 200, standard
        { amount: 100, vat_amount: 0, transaction_date: "2026-07-06", vat_supply_type: "zero_rated" },
        { amount: 999, vat_amount: 0, transaction_date: "2026-07-07", is_personal: true }, // owner's money
        { amount: 999, vat_amount: 0, transaction_date: "2026-07-08", matched_invoice_id: "a" }, // already invoiced
      ]
    );
    expect(s).toEqual({ standard: 200, zero_rated: 100, exempt: 0, total: 300 });
  });

  it("excludes transactions outside the period at both ends", () => {
    const s = supplies([
      { id: "in", issue_date: "2026-07-01", invoice_amount: 100, vat_supply_type: "standard" },
      { id: "before", issue_date: "2026-06-30", invoice_amount: 999, vat_supply_type: "standard" },
      { id: "after", issue_date: "2026-08-01", invoice_amount: 999, vat_supply_type: "standard" },
    ]);
    expect(s.standard).toBe(100);
  });
});

describe("suppliesByType — customer credit notes net their invoice's bucket", () => {
  const invoices = [
    { id: "inv-std", issue_date: "2026-07-10", invoice_amount: 1000, vat_supply_type: "standard" },
    { id: "inv-zero", issue_date: "2026-07-11", invoice_amount: 500, vat_supply_type: "zero_rated" },
  ];

  it("a zero-rated sale's credit comes off field 2, not field 1", () => {
    const s = supplies(invoices, [], [
      { ledger: "customer", issue_date: "2026-07-20", invoice_id: "inv-zero", amount: 200, vat_amount: 0 },
    ]);
    expect(s.standard).toBe(1000); // field 1 untouched
    expect(s.zero_rated).toBe(300); // 500 − 200
  });

  it("backs VAT out of a standard credit's inclusive amount before netting", () => {
    const s = supplies(invoices, [], [
      { ledger: "customer", issue_date: "2026-07-20", invoice_id: "inv-std", amount: 115, vat_amount: 15 },
    ]);
    expect(s.standard).toBe(900); // 1000 − (115 − 15)
  });

  it("resolves the bucket even when the credited invoice is in an earlier period", () => {
    const s = supplies(
      [
        ...invoices,
        { id: "inv-prior", issue_date: "2026-06-15", invoice_amount: 800, vat_supply_type: "zero_rated" },
      ],
      [],
      [{ ledger: "customer", issue_date: "2026-07-22", invoice_id: "inv-prior", amount: 80, vat_amount: 0 }]
    );
    expect(s.zero_rated).toBe(420); // 500 (in-period sale) − 80 (credit for the prior-period sale)
  });

  it("falls back to standard for a credit with no invoice link or an unresolvable one", () => {
    const s = supplies(invoices, [], [
      { ledger: "customer", issue_date: "2026-07-20", invoice_id: null, amount: 57.5, vat_amount: 7.5 },
      { ledger: "customer", issue_date: "2026-07-21", invoice_id: "inv-ghost", amount: 23, vat_amount: 3 },
    ]);
    expect(s.standard).toBe(930); // 1000 − 50 − 20
    expect(s.zero_rated).toBe(500);
  });

  it("ignores supplier-ledger credits and credits outside the period", () => {
    const s = supplies(invoices, [], [
      { ledger: "supplier", issue_date: "2026-07-20", invoice_id: "inv-std", amount: 999, vat_amount: 0 },
      { ledger: "customer", issue_date: "2026-08-01", invoice_id: "inv-std", amount: 999, vat_amount: 0 },
    ]);
    expect(s).toEqual({ standard: 1000, zero_rated: 500, exempt: 0, total: 1500 });
  });

  it("nets a full mixed period consistently across all three buckets", () => {
    const s = supplies(
      [
        { id: "inv-std", issue_date: "2026-07-10", invoice_amount: 1000, vat_supply_type: "standard" },
        { id: "inv-zero", issue_date: "2026-07-11", invoice_amount: 500, vat_supply_type: "zero_rated" },
        { id: "inv-ex", issue_date: "2026-07-12", invoice_amount: 300, vat_supply_type: "exempt" },
      ],
      [{ amount: 230, vat_amount: 30, transaction_date: "2026-07-05" }],
      [
        { ledger: "customer", issue_date: "2026-07-20", invoice_id: "inv-std", amount: 115, vat_amount: 15 },
        { ledger: "customer", issue_date: "2026-07-21", invoice_id: "inv-zero", amount: 200, vat_amount: 0 },
      ]
    );
    // standard: 1000 + 200 − 100 = 1100; zero: 500 − 200 = 300; exempt: 300
    expect(s).toEqual({ standard: 1100, zero_rated: 300, exempt: 300, total: 1700 });
  });
});
