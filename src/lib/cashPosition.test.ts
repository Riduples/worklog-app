import { describe, expect, it } from "vitest";
import { cashOnHand, adjustedPosition } from "@/lib/cashPosition";
import type { BankAccount } from "@/lib/supabase/hooks/useBankAccounts";

const account = (over: Partial<BankAccount> = {}) =>
  ({ id: "a1", opening_balance: 0, opening_balance_date: null, ...over }) as BankAccount;

const inRow = (amount: number, over: { account_id?: string | null; transaction_date?: string } = {}) => ({
  account_id: "a1",
  transaction_date: "2026-05-10",
  amount,
  ...over,
});

describe("cashOnHand", () => {
  it("is zero with nothing at all", () => {
    expect(cashOnHand([], [], [], [])).toBe(0);
    expect(cashOnHand(null, null, null, null)).toBe(0);
  });

  it("sums every account's running balance, opening balances included", () => {
    const accounts = [
      account({ id: "a1", opening_balance: 1000 }),
      account({ id: "a2", opening_balance: 500 }),
    ];
    const income = [inRow(200, { account_id: "a1" }), inRow(50, { account_id: "a2" })];
    const expenses = [inRow(75, { account_id: "a1" })];
    expect(cashOnHand(accounts, income, expenses, [])).toBe(1675);
  });

  it("counts transfers between the business's own accounts once on each side", () => {
    const accounts = [
      account({ id: "a1", opening_balance: 1000 }),
      account({ id: "a2", opening_balance: 0 }),
    ];
    const transfers = [{ from_account_id: "a1", to_account_id: "a2", amount: 400, transfer_date: "2026-05-11" }];
    // A transfer moves money, it doesn't create or destroy it — the total is unchanged.
    expect(cashOnHand(accounts, [], [], transfers)).toBe(1000);
  });

  it("counts money logged without an account — it still moved", () => {
    // A cash sale taken before the business added its bank details is real cash.
    // accountBalance() only sees rows tagged to an account, so untagged rows have
    // to be added back or they vanish from a figure called "cash on hand".
    const accounts = [account({ id: "a1", opening_balance: 1000 })];
    const income = [inRow(200, { account_id: "a1" }), inRow(300, { account_id: null })];
    const expenses = [inRow(50, { account_id: null })];
    expect(cashOnHand(accounts, income, expenses, [])).toBe(1450);
  });

  it("falls back to all-time money in less money out when no accounts are set up", () => {
    const income = [inRow(3000, { account_id: null }), inRow(1000, { account_id: null })];
    const expenses = [inRow(1200, { account_id: null })];
    expect(cashOnHand([], income, expenses, [])).toBe(2800);
  });

  it("takes no period — cash held is a moment, not a window", () => {
    // Rows from two different months, no period predicate anywhere in the signature.
    const income = [inRow(100, { transaction_date: "2026-01-04" }), inRow(100, { transaction_date: "2026-05-04" })];
    expect(cashOnHand([], income, [], [])).toBe(200);
  });
});

describe("adjustedPosition", () => {
  it("is cash on hand plus what's owed to you, less what you owe", () => {
    expect(adjustedPosition(2800, 1500, 400)).toBe(3900);
  });

  it("goes negative when payables exceed cash and receivables", () => {
    expect(adjustedPosition(100, 200, 1000)).toBe(-700);
  });

  it("does not depend on the reporting period — the old bug", () => {
    // The regression this module exists for: the position used to be built from
    // the PERIOD's net cash flow, so picking "Today" instead of "This year" moved
    // the answer even though nothing about what the business holds or is owed had
    // changed. Cash on hand is the same figure whichever pill is selected.
    const accounts = [account({ opening_balance: 5000 })];
    const income = [inRow(2000, { transaction_date: "2026-01-04" })];
    const expenses = [inRow(500, { transaction_date: "2026-05-04" })];
    const cash = cashOnHand(accounts, income, expenses, []);
    expect(cash).toBe(6500);
    // Same inputs, same position — there is no period argument to vary.
    expect(adjustedPosition(cash, 1000, 300)).toBe(7200);
  });
});
