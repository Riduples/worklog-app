import { describe, expect, it } from "vitest";
import { suppliesByType, inputVatTotal } from "./vat201";

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

  it("excludes credit-settlement income (e.g. a supplier refund) — it isn't a supply", () => {
    const s = supplies(
      [],
      [
        { amount: 230, vat_amount: 30, transaction_date: "2026-07-05" }, // real cash sale, net 200
        { amount: 1150, vat_amount: 0, transaction_date: "2026-07-09", is_credit_settlement: true }, // refund in
      ]
    );
    expect(s).toEqual({ standard: 200, zero_rated: 0, exempt: 0, total: 200 });
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

describe("inputVatTotal", () => {
  const si = (over: Partial<{ issue_date: string; vat_amount: number }> = {}) => ({
    issue_date: "2026-07-10",
    vat_amount: 150,
    ...over,
  });
  const exp = (
    over: Partial<{
      transaction_date: string;
      amount: number;
      vat_amount: number;
      matched_supplier_invoice_id: string | null;
      matched_ledger_entry_id: string | null;
      is_personal: boolean;
      is_credit_settlement: boolean;
    }> = {}
  ) => ({ transaction_date: "2026-07-10", amount: 1150, vat_amount: 150, ...over });

  const period = ["2026-07-01", "2026-07-31"] as const;

  it("claims VAT off supplier invoices, as it always did", () => {
    expect(inputVatTotal([si({ vat_amount: 150 })], [], ...period)).toBe(150);
  });

  it("also claims VAT on a purchase with no supplier invoice behind it", () => {
    // The whole point: cement paid for in cash carries claimable VAT, and
    // reading supplier invoices alone gave it away.
    expect(inputVatTotal([], [exp({ vat_amount: 150 })], ...period)).toBe(150);
  });

  it("adds both sources together", () => {
    expect(inputVatTotal([si({ vat_amount: 100 })], [exp({ vat_amount: 50 })], ...period)).toBe(150);
  });

  it("never claims the same VAT twice when a payment settles a supplier invoice", () => {
    // The invoice already contributed its VAT; the payment must not claim it too.
    const out = inputVatTotal(
      [si({ vat_amount: 150 })],
      [exp({ vat_amount: 150, matched_supplier_invoice_id: "si1" })],
      ...period
    );
    expect(out).toBe(150);
  });

  it("never claims VAT when a payment settles a supplier ledger credit either", () => {
    // A ledger credit carries no VAT split and the P&L counts it gross, so the
    // matched payment must not claim its own VAT — else P&L and VAT201 disagree.
    expect(inputVatTotal([], [exp({ vat_amount: 150, matched_ledger_entry_id: "le1" })], ...period)).toBe(0);
  });

  it("leaves out owner's drawings — not a business purchase", () => {
    expect(inputVatTotal([], [exp({ vat_amount: 150, is_personal: true })], ...period)).toBe(0);
  });

  it("leaves out a refund settlement, whose VAT nets via the credit note", () => {
    expect(inputVatTotal([], [exp({ vat_amount: 150, is_credit_settlement: true })], ...period)).toBe(0);
  });

  it("counts only what falls inside the period, on both sources", () => {
    const out = inputVatTotal(
      [si({ issue_date: "2026-06-30", vat_amount: 999 })],
      [exp({ transaction_date: "2026-08-01", vat_amount: 999 })],
      ...period
    );
    expect(out).toBe(0);
  });

  it("treats a pre-VAT expense row as carrying none", () => {
    // Every expense logged before the column existed reads vat_amount 0, so no
    // historic return moves.
    expect(inputVatTotal([], [{ transaction_date: "2026-07-10", amount: 500 }], ...period)).toBe(0);
  });

  it("handles nothing at all", () => {
    expect(inputVatTotal(null, undefined, ...period)).toBe(0);
  });
});
