import { describe, expect, it } from "vitest";
import {
  creditVatWithin,
  initialOnAccount,
  initialStatus,
  sumCredits,
  sumCreditVat,
  sumOnAccount,
  creditedAgainstInvoice,
  type CreditNote,
} from "./creditNotes";

// A credit note mirrors the invoice it reverses: for a VAT business the amount is
// VAT-INCLUSIVE and the VAT is backed out of it. R1150 incl @ 15% → R150 VAT.
describe("creditVatWithin", () => {
  it("backs VAT out of a VAT-inclusive credit", () => {
    expect(creditVatWithin(1150, 0.15, true)).toBe(150);
  });
  it("is zero for a non-VAT business", () => {
    expect(creditVatWithin(1150, 0.15, false)).toBe(0);
  });
  it("is zero when there is no rate", () => {
    expect(creditVatWithin(1150, 0, true)).toBe(0);
  });
});

// On-account math: "account" holds the whole credit; "reduce" applies it to the
// balance and only the overflow spills onto the account.
describe("initialOnAccount", () => {
  it("holds the whole credit when put on account", () => {
    expect(initialOnAccount(575, 400, "account")).toBe(575);
  });
  it("holds nothing when a reduce credit fits inside the balance", () => {
    expect(initialOnAccount(400, 1000, "reduce")).toBe(0);
  });
  it("spills the overflow when a reduce credit exceeds the balance", () => {
    // owing 400, credit 575 → 0 owing + 175 on account
    expect(initialOnAccount(575, 400, "reduce")).toBe(175);
  });
});

describe("initialStatus", () => {
  it("is on_account when any amount remains owed", () => {
    expect(initialStatus(175)).toBe("on_account");
  });
  it("is applied when the credit was fully used against the invoice", () => {
    expect(initialStatus(0)).toBe("applied");
  });
});

function cn(partial: Partial<CreditNote>): CreditNote {
  return {
    id: "cn",
    business_id: "b",
    user_id: "u",
    doc_number: "CN-2026-0001",
    ledger: "customer",
    invoice_id: null,
    supplier_invoice_id: null,
    original_doc_number: null,
    contact_id: null,
    contact_name: "Acme",
    amount: 0,
    vat_rate: 0.15,
    vat_amount: 0,
    scope: "whole",
    line_items: [],
    reason: null,
    settlement: "account",
    on_account_balance: 0,
    status: "on_account",
    issue_date: "2026-07-01",
    deleted_at: null,
    created_at: null,
    updated_at: null,
    ...partial,
  } as CreditNote;
}

describe("netting selectors", () => {
  const rows: CreditNote[] = [
    cn({ ledger: "customer", amount: 575, vat_amount: 75, on_account_balance: 175, status: "on_account" }),
    cn({ ledger: "customer", amount: 200, vat_amount: 0, on_account_balance: 0, status: "applied" }),
    cn({ ledger: "supplier", amount: 300, vat_amount: 39.13, on_account_balance: 300, status: "on_account" }),
    cn({ ledger: "supplier", amount: 100, vat_amount: 13.04, on_account_balance: 0, status: "refunded" }),
  ];

  it("sums every credit on a side (reduces revenue/cost regardless of settlement)", () => {
    expect(sumCredits(rows, "customer")).toBe(775);
    expect(sumCredits(rows, "supplier")).toBe(400);
  });

  it("sums reversed VAT on a side", () => {
    expect(sumCreditVat(rows, "customer")).toBe(75);
    expect(sumCreditVat(rows, "supplier")).toBe(52.17);
  });

  it("counts only still-on-account balances", () => {
    expect(sumOnAccount(rows, "customer")).toBe(175);
    expect(sumOnAccount(rows, "supplier")).toBe(300);
  });

  it("totals what has already been credited against one invoice", () => {
    const inv = [
      cn({ invoice_id: "inv-1", amount: 400 }),
      cn({ invoice_id: "inv-1", amount: 175 }),
      cn({ invoice_id: "inv-2", amount: 999 }),
    ];
    expect(creditedAgainstInvoice(inv, "inv-1")).toBe(575);
  });
});
