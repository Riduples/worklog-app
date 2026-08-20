"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import { useAccountTransfers } from "@/lib/supabase/hooks/useAccountTransfers";
import { useInvoices } from "@/lib/supabase/hooks/useInvoices";
import { useSupplierInvoices } from "@/lib/supabase/hooks/useSupplierInvoices";
import { toBankingRows, type BankingSource, type BankingTx } from "@/lib/banking";

/** Which table a Banking row actually lives in. */
const TABLE: Record<BankingSource, "income" | "expenses" | "account_transfers"> = {
  income: "income",
  expense: "expenses",
  transfer: "account_transfers",
};

const KEY: Record<BankingSource, string> = {
  income: "income",
  expense: "expenses",
  transfer: "account_transfers",
};

/**
 * Every rand that moved, as one list.
 *
 * Composed from the hooks that already serve those tables rather than a query of
 * its own, so a Banking row and the same row seen on the dashboard come from one
 * cache and can never disagree — and saving anything through the existing
 * mutations refreshes this list for free.
 */
export function useBankingTransactions(): { rows: BankingTx[]; isLoading: boolean } {
  const income = useIncome();
  const expenses = useExpenses();
  const transfers = useAccountTransfers();
  const invoices = useInvoices();
  const supplierInvoices = useSupplierInvoices();

  const rows = toBankingRows({
    income: income.data,
    expenses: expenses.data,
    transfers: transfers.data,
    invoiceLabels: new Map((invoices.data ?? []).map((i) => [i.id, i.doc_number ?? "Invoice"])),
    supplierInvoiceLabels: new Map(
      (supplierInvoices.data ?? []).map((si) => [si.id, si.doc_number ?? si.supplier_ref_number ?? "Bill"])
    ),
  });

  return {
    rows,
    isLoading: income.isLoading || expenses.isLoading || transfers.isLoading,
  };
}

function useInvalidateBanking() {
  const queryClient = useQueryClient();
  return (source: BankingSource) => {
    queryClient.invalidateQueries({ queryKey: [KEY[source]] });
  };
}

/**
 * Tick a row off against the bank statement, or untick it.
 *
 * A timestamp, not a flag: "when was this agreed" is the question a later
 * argument actually asks, and clearing it is a null away.
 */
export function useSetReconciled() {
  const supabase = createClient();
  const invalidate = useInvalidateBanking();
  return useMutation({
    mutationFn: async ({ source, id, reconciled }: { source: BankingSource; id: string; reconciled: boolean }) => {
      const { error } = await supabase
        .from(TABLE[source])
        .update({ reconciled_at: reconciled ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
      return source;
    },
    onSuccess: (source) => invalidate(source),
  });
}

/**
 * Remove a transaction.
 *
 * Soft, in all three tables, for the reason every other soft delete in this app
 * is soft: a deleted row still has to be missing from the reports without taking
 * the reports' history with it. Nothing here is ever hard-deleted, because
 * anything in this list has, by definition, moved money.
 */
export function useDeleteBankingTx() {
  const supabase = createClient();
  const invalidate = useInvalidateBanking();
  return useMutation({
    mutationFn: async ({ source, id }: { source: BankingSource; id: string }) => {
      const { error } = await supabase
        .from(TABLE[source])
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return source;
    },
    onSuccess: (source) => invalidate(source),
  });
}
