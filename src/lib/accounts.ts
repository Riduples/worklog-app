import type { BankAccount } from "@/lib/supabase/hooks/useBankAccounts";

type Movement = { account_id: string | null; amount: number; transaction_date: string };
type TransferMovement = { from_account_id: string; to_account_id: string; amount: number; transfer_date: string };

// A bank account's running balance is a cash figure: opening balance, plus the
// gross money in, minus the gross money out, plus transfers in, minus transfers
// out — for rows tagged to it and dated on or after the opening date (a null
// opening date counts everything). This is the bank/reconciliation view —
// deliberately NOT the accrual profit, which has no per-account meaning (an
// invoice isn't money sitting in any one account).
export function accountBalance(
  account: BankAccount,
  income: Movement[],
  expenses: Movement[],
  transfers: TransferMovement[] = []
): number {
  const from = account.opening_balance_date;
  const onOrAfter = (d: string) => !from || d >= from;
  let balance = Number(account.opening_balance) || 0;
  for (const i of income) {
    if (i.account_id === account.id && onOrAfter(i.transaction_date)) balance += Number(i.amount) || 0;
  }
  for (const e of expenses) {
    if (e.account_id === account.id && onOrAfter(e.transaction_date)) balance -= Number(e.amount) || 0;
  }
  // A transfer moves money between the business's own accounts — out of "from",
  // into "to". Not income or expense; it only shifts the running balance.
  for (const t of transfers) {
    if (!onOrAfter(t.transfer_date)) continue;
    if (t.to_account_id === account.id) balance += Number(t.amount) || 0;
    if (t.from_account_id === account.id) balance -= Number(t.amount) || 0;
  }
  return balance;
}

export type StatementMeta = { bank_name?: string; account_number?: string } | null | undefined;
type AccountMatchLite = { id: string; name: string; bank_name: string | null; account_number: string | null };

export const last4 = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").slice(-4);

// Match an uploaded statement to one of the saved accounts. The account number
// (last 4 digits) is the reliable signal; bank name is a softer fallback. Returns
// the matched id — or null, which forces a conscious pick rather than silently
// filing a whole statement under the wrong account.
export function matchStatementAccount(
  stmt: StatementMeta,
  accounts: AccountMatchLite[]
): { accountId: string | null; note: string; matched: boolean } {
  if (accounts.length === 0) return { accountId: null, note: "", matched: false };
  if (accounts.length === 1) return { accountId: accounts[0]!.id, note: "", matched: true };

  const stmtLast4 = last4(stmt?.account_number);
  if (stmtLast4.length === 4) {
    const byNumber = accounts.filter((a) => last4(a.account_number).length === 4 && last4(a.account_number) === stmtLast4);
    if (byNumber.length === 1) return { accountId: byNumber[0]!.id, note: `Matched to ${byNumber[0]!.name} by account number`, matched: true };
  }

  const bank = (stmt?.bank_name ?? "").trim().toLowerCase();
  if (bank.length >= 2) {
    const byBank = accounts.filter((a) => {
      const ab = (a.bank_name ?? "").trim().toLowerCase();
      return ab.length >= 2 && (ab.includes(bank) || bank.includes(ab));
    });
    if (byBank.length === 1) return { accountId: byBank[0]!.id, note: `Looks like ${byBank[0]!.name} — check it's the right account`, matched: true };
  }

  return { accountId: null, note: "We couldn't tell which account this statement is for — please choose below.", matched: false };
}
