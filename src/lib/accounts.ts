import type { BankAccount } from "@/lib/supabase/hooks/useBankAccounts";

type Movement = { account_id: string | null; amount: number; transaction_date: string };

// A bank account's running balance is a cash figure: opening balance, plus the
// gross money in, minus the gross money out, for rows tagged to it and dated on or
// after the opening date (a null opening date counts everything). This is the
// bank/reconciliation view — deliberately NOT the accrual profit, which has no
// per-account meaning (an invoice isn't money sitting in any one account).
export function accountBalance(account: BankAccount, income: Movement[], expenses: Movement[]): number {
  const from = account.opening_balance_date;
  const onOrAfter = (d: string) => !from || d >= from;
  let balance = Number(account.opening_balance) || 0;
  for (const i of income) {
    if (i.account_id === account.id && onOrAfter(i.transaction_date)) balance += Number(i.amount) || 0;
  }
  for (const e of expenses) {
    if (e.account_id === account.id && onOrAfter(e.transaction_date)) balance -= Number(e.amount) || 0;
  }
  return balance;
}
