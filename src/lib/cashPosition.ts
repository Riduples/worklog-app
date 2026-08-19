import type { BankAccount } from "@/lib/supabase/hooks/useBankAccounts";
import { accountBalance } from "@/lib/accounts";

// Where the business stands right now, in cash terms.
//
// The distinction this module exists to hold: cash FLOW is a movement over a
// chosen period, cash POSITION is a balance at a moment. The Cash Flow report
// used to build its "adjusted position" out of the period's net cash flow plus
// all-time receivables and payables — a month (or a single day, on the "Today"
// pill) added to forever, with every rand banked before the window silently
// dropped. Changing the period moved one third of the figure and left the rest,
// so the answer meant nothing and never matched the balance the dashboard shows.
//
// A position takes no period. Nothing here is period-filtered, deliberately.

type Movement = { account_id: string | null; amount: number; transaction_date: string };
type TransferMovement = { from_account_id: string; to_account_id: string; amount: number; transfer_date: string };

/**
 * What the saved accounts hold right now — the sum of their running balances.
 *
 * This is the dashboard's "in your accounts now" figure. It is deliberately
 * narrower than cashOnHand() below: money logged without an account is real,
 * but it is not in any account, so it does not belong under this label. The two
 * agree whenever every row is tagged to an account.
 */
export function bankedBalance(
  accounts: BankAccount[] | null | undefined,
  income: Movement[] | null | undefined,
  expenses: Movement[] | null | undefined,
  transfers: TransferMovement[] | null | undefined
): number {
  return (accounts ?? []).reduce(
    (s, a) => s + accountBalance(a, income ?? [], expenses ?? [], transfers ?? []),
    0
  );
}

/**
 * Cash held right now, across every account.
 *
 * With accounts set up this is their real running balance — opening balance,
 * movements and transfers — via the same accountBalance() the dashboard's "in
 * your accounts now" uses, so the two screens cannot disagree.
 *
 * With no accounts set up there is no opening balance to carry, so every rand
 * logged since the beginning is the cash accumulated: all-time money in less
 * money out. That is an estimate, and the caller says so on screen — but it
 * beats printing a confident zero for a business that simply hasn't added its
 * bank details yet.
 *
 * Gross, not ex-VAT: cash is cash, VAT included, which is what makes this a
 * different figure from profit rather than a competing version of it.
 */
export function cashOnHand(
  accounts: BankAccount[] | null | undefined,
  income: Movement[] | null | undefined,
  expenses: Movement[] | null | undefined,
  transfers: TransferMovement[] | null | undefined
): number {
  const accts = accounts ?? [];
  const inRows = income ?? [];
  const outRows = expenses ?? [];
  const net = (rows: Movement[]) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  if (accts.length === 0) return net(inRows) - net(outRows);

  const banked = bankedBalance(accts, inRows, outRows, transfers);

  // Rows logged without an account still moved real money — a cash sale taken
  // before the business added its bank details, say. accountBalance() only counts
  // rows tagged to the account it was given, so those would vanish from a figure
  // called "cash on hand". They are added back here.
  //
  // This is why cash on hand can exceed the dashboard's "in your accounts now":
  // that line is about the accounts, and correctly counts only what is in them.
  // This one is about the business's cash, wherever it is sitting.
  const untagged = inRows.filter((r) => !r.account_id);
  const untaggedOut = outRows.filter((r) => !r.account_id);
  return banked + net(untagged) - net(untaggedOut);
}

/**
 * Cash on hand, adjusted for what is still owed in both directions — the
 * business's position once the books catch up with the bank.
 *
 * All three inputs are point-in-time, which is the whole point: a receivable is
 * outstanding or it isn't, regardless of which period the report is showing.
 */
export function adjustedPosition(cash: number, owedToYou: number, youOwe: number): number {
  return cash + owedToYou - youOwe;
}
