import { describe, expect, it } from "vitest";
import { accountBalance, last4, matchStatementAccount } from "./accounts";
import type { BankAccount } from "@/lib/supabase/hooks/useBankAccounts";

const mkAccount = (over: Partial<BankAccount>): BankAccount => ({
  id: "a1",
  business_id: "b",
  user_id: "u",
  name: "A",
  bank_name: null,
  account_number: null,
  account_type: "bank",
  opening_balance: 0,
  opening_balance_date: null,
  is_default: false,
  created_at: null,
  updated_at: null,
  deleted_at: null,
  ...over,
});

const lite = (id: string, name: string, bank_name: string | null, account_number: string | null) => ({
  id,
  name,
  bank_name,
  account_number,
});

describe("last4", () => {
  it("strips non-digits and takes the last four", () => {
    expect(last4("**** 1234")).toBe("1234");
    expect(last4("62-1234-5678")).toBe("5678");
    expect(last4("12")).toBe("12");
    expect(last4(null)).toBe("");
  });
});

describe("matchStatementAccount", () => {
  const fnb = lite("fnb", "FNB Cheque", "FNB", "624321");
  const cap = lite("cap", "Capitec", "Capitec", "118899");

  it("returns no match when there are no accounts", () => {
    expect(matchStatementAccount({ bank_name: "FNB", account_number: "1234" }, [])).toEqual({
      accountId: null,
      note: "",
      matched: false,
    });
  });

  it("auto-selects the only account without needing to detect anything", () => {
    const r = matchStatementAccount({ bank_name: "", account_number: "" }, [fnb]);
    expect(r.accountId).toBe("fnb");
    expect(r.matched).toBe(true);
  });

  it("matches on the last 4 digits of the account number, ignoring masking", () => {
    const r = matchStatementAccount({ bank_name: "", account_number: "**** **** 4321" }, [fnb, cap]);
    expect(r.accountId).toBe("fnb");
    expect(r.matched).toBe(true);
  });

  it("falls back to a unique bank-name match when the number doesn't match", () => {
    const r = matchStatementAccount({ bank_name: "Capitec Bank", account_number: "" }, [fnb, cap]);
    expect(r.accountId).toBe("cap");
    expect(r.matched).toBe(true);
  });

  it("forces a manual pick (no silent default) when nothing matches", () => {
    const r = matchStatementAccount({ bank_name: "Nedbank", account_number: "0000" }, [fnb, cap]);
    expect(r.accountId).toBeNull();
    expect(r.matched).toBe(false);
  });

  it("does not guess when the bank name is ambiguous across accounts", () => {
    const fnb2 = lite("fnb2", "FNB Savings", "FNB", "629999");
    const r = matchStatementAccount({ bank_name: "FNB", account_number: "0000" }, [fnb, fnb2]);
    expect(r.accountId).toBeNull(); // two FNB accounts → can't tell which → ask
    expect(r.matched).toBe(false);
  });

  it("prefers the account number over the bank name", () => {
    // Header says FNB but the number belongs to Capitec → trust the number.
    const r = matchStatementAccount({ bank_name: "FNB", account_number: "8899" }, [fnb, cap]);
    expect(r.accountId).toBe("cap");
  });
});

describe("accountBalance", () => {
  const income = [
    { account_id: "a1", amount: 500, transaction_date: "2026-02-01" },
    { account_id: "a2", amount: 999, transaction_date: "2026-02-01" }, // other account
    { account_id: "a1", amount: 100, transaction_date: "2025-12-01" }, // before the opening date
  ];
  const expenses = [{ account_id: "a1", amount: 200, transaction_date: "2026-03-01" }];

  it("is opening balance plus tagged money in, less money out, from the opening date", () => {
    const acc = mkAccount({ id: "a1", opening_balance: 1000, opening_balance_date: "2026-01-01" });
    // 1000 + 500 (Feb, a1) − 200 (Mar, a1); the a2 row and the pre-opening row are excluded.
    expect(accountBalance(acc, income, expenses)).toBe(1300);
  });

  it("counts everything tagged to it when there's no opening date", () => {
    const acc = mkAccount({ id: "a1", opening_balance: 0, opening_balance_date: null });
    // 0 + 500 + 100 (both a1, no date floor) − 200
    expect(accountBalance(acc, income, expenses)).toBe(400);
  });

  it("excludes rows dated on the opening date (the opening balance already reflects that day)", () => {
    const acc = mkAccount({ id: "a1", opening_balance: 1000, opening_balance_date: "2026-01-01" });
    const sameDay = [{ account_id: "a1", amount: 500, transaction_date: "2026-01-01" }];
    const sameDayOut = [{ account_id: "a1", amount: 200, transaction_date: "2026-01-01" }];
    // "Balance today" is as-of the opening date, so a same-dated movement is
    // already in it — counting it again would double the boundary day.
    expect(accountBalance(acc, sameDay, sameDayOut)).toBe(1000);
  });

  it("shifts the balance on transfers in and out, from the opening date", () => {
    const acc = mkAccount({ id: "a1", opening_balance: 1000, opening_balance_date: "2026-01-01" });
    const transfers = [
      { from_account_id: "a1", to_account_id: "a2", amount: 300, transfer_date: "2026-02-01" }, // out of a1
      { from_account_id: "a2", to_account_id: "a1", amount: 50, transfer_date: "2026-02-05" }, // into a1
      { from_account_id: "a1", to_account_id: "a2", amount: 999, transfer_date: "2025-12-01" }, // before opening → ignored
    ];
    // 1000 + 500 (Feb income) − 200 (Mar expense) − 300 (out) + 50 (in) = 1050
    expect(accountBalance(acc, income, expenses, transfers)).toBe(1050);
  });
});
