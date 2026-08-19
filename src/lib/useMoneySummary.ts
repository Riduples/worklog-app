"use client";

import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import { useInvoices } from "@/lib/supabase/hooks/useInvoices";
import { useSupplierInvoices } from "@/lib/supabase/hooks/useSupplierInvoices";
import { useLedgerEntries } from "@/lib/supabase/hooks/useLedger";
import { useCreditNotes } from "@/lib/supabase/hooks/useCreditNotes";
import { useBankAccounts, type BankAccount } from "@/lib/supabase/hooks/useBankAccounts";
import { useAccountTransfers } from "@/lib/supabase/hooks/useAccountTransfers";
import { computePnl, type Pnl } from "@/lib/pnl";
import { accountBalance } from "@/lib/accounts";
import { bankedBalance, cashOnHand } from "@/lib/cashPosition";
import { inPeriod, type Period } from "@/lib/period";
import { ALL_ACCOUNTS, type AccountFilter } from "@/components/ui/BankAccountSelector";
import type { Tables } from "@/lib/types/database";

// The one place the money figures are assembled, so the dashboard hero, Profit &
// Loss and Cash Flow cannot show different answers for the same question.
//
// pnl.ts already held the one definition of profit — but each screen still built
// its own inputs and called it separately, and that is exactly how the dashboard
// came to omit credit notes and report a profit its own P&L report disagreed
// with. Centralising the formula was not enough; the CALL has to be shared too.
//
// Every screen's data hook is a TanStack query keyed by table, so gathering them
// here costs no extra fetch — a view calling useIncome() itself reads the same
// cache entry.

export type MoneySummary = {
  /** The period predicate, so callers can filter their own extras the same way. */
  within: (dateStr: string) => boolean;
  isAllAccounts: boolean;
  selectedAccount: BankAccount | null;
  hasAccounts: boolean;

  /** Income/expense rows for the chosen account (all periods — filter with `within`). */
  incomeRows: Tables<"income">[];
  expenseRows: Tables<"expenses">[];

  /**
   * Profit for the period. Accrual under "All accounts"; cash-basis for a single
   * account, whose own rows carry no business-wide invoices or supplier credit.
   */
  pnl: Pnl;

  /**
   * Every rand that MOVED in the period for the chosen account, VAT included.
   * Cash, not profit: no accrual netting and nothing excluded, because a bank
   * balance moves whoever the money belonged to.
   */
  grossIn: number;
  grossOut: number;

  /** Running balance of the selected account; 0 under "All accounts". */
  accountBalance: number;
  /** What the saved accounts hold right now — "in your accounts now". */
  banked: number;
  /** All cash the business holds right now, including untagged rows. */
  cash: number;
};

export function useMoneySummary(period: Period, account: AccountFilter): MoneySummary {
  const { data: income } = useIncome();
  const { data: expenses } = useExpenses();
  const { data: invoices } = useInvoices();
  const { data: supplierInvoices } = useSupplierInvoices();
  const { data: ledger } = useLedgerEntries();
  const { data: creditNotes } = useCreditNotes();
  const { data: accounts } = useBankAccounts();
  const { data: transfers } = useAccountTransfers();

  const within = inPeriod(period);
  const isAllAccounts = account === ALL_ACCOUNTS;
  const selectedAccount = (accounts ?? []).find((a) => a.id === account) ?? null;

  const incomeRows = isAllAccounts ? (income ?? []) : (income ?? []).filter((r) => r.account_id === account);
  const expenseRows = isAllAccounts ? (expenses ?? []) : (expenses ?? []).filter((r) => r.account_id === account);

  // creditNotes belongs in this list — leaving it out is the bug this hook exists
  // to make impossible, since there is now only one place it could go missing.
  //
  // A single account gets the cash-basis path: invoices and supplier credit are
  // business-wide claims, not money sitting in any one account, so the account's
  // own rows are counted directly. Running them through the accrual path instead
  // would net every invoice-matched rand against documents that aren't in the
  // inputs, silently zeroing them.
  const pnl = isAllAccounts
    ? computePnl({ income, expenses, invoices, supplierInvoices, ledger, creditNotes }, within)
    : computePnl({ income: incomeRows, expenses: expenseRows }, within, { cashBasis: true });

  const grossIn = incomeRows.filter((r) => within(r.transaction_date)).reduce((s, r) => s + Number(r.amount || 0), 0);
  const grossOut = expenseRows.filter((r) => within(r.transaction_date)).reduce((s, r) => s + Number(r.amount || 0), 0);

  return {
    within,
    isAllAccounts,
    selectedAccount,
    hasAccounts: (accounts ?? []).length > 0,
    incomeRows,
    expenseRows,
    pnl,
    grossIn,
    grossOut,
    // Balances are point-in-time and take no period — see cashPosition.ts.
    accountBalance: selectedAccount ? accountBalance(selectedAccount, income ?? [], expenses ?? [], transfers ?? []) : 0,
    banked: bankedBalance(accounts, income, expenses, transfers),
    cash: cashOnHand(accounts, income, expenses, transfers),
  };
}
