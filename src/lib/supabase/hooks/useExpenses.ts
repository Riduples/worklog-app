"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { captureWrite } from "@/lib/offline/capture";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

export type Expense = Tables<"expenses">;

const QUERY_KEY = ["expenses"];

export function useExpenses() {
  const supabase = createClient();
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
  });
}

export function useCreateExpense() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expense: Omit<TablesInsert<"expenses">, "user_id" | "business_id">) =>
      captureWrite(supabase, "expenses", expense),
    onSuccess: (result) => {
      // Refetch the list only when the write actually reached the server; a
      // queued write has nothing new to fetch and the refetch would just fail
      // offline. The flusher invalidates ["expenses"] itself once it syncs.
      if (!result.queued) queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["outbox"] }); // update the sync indicator
    },
  });
}

/**
 * Edit a row that is already saved.
 *
 * Banking lets a transaction be corrected in place — a wrong amount, a category
 * picked in haste, a payment matched to the wrong document. Before this there
 * was only create, so the only way to fix one was to delete it and log it again,
 * which loses whatever it was matched to.
 */
export function useUpdateExpense() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: TablesUpdate<"expenses"> }) => {
      const { data, error } = await supabase
        .from("expenses")
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });
}
