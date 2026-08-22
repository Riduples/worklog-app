"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

export type AccountTransfer = Tables<"account_transfers">;

const QUERY_KEY = ["account_transfers"];

export function useAccountTransfers() {
  const supabase = createClient();
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_transfers")
        .select("*")
        .is("deleted_at", null)
        .order("transfer_date", { ascending: false });
      if (error) throw error;
      return data as AccountTransfer[];
    },
  });
}

export function useCreateTransfer() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transfer: Omit<TablesInsert<"account_transfers">, "user_id" | "business_id">) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const businessId = await getCurrentBusinessId(supabase);
      const { data, error } = await supabase
        .from("account_transfers")
        .insert({ ...transfer, user_id: user.id, business_id: businessId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    // Balances everywhere derive from transfers, so nudge the account-consuming
    // views too, not just the transfer list.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/**
 * Correct a transfer that was logged wrong.
 *
 * Banking lets you tap any row to change it, and a transfer is a row like the
 * others. Without this, opening one gave you an empty form that saved a SECOND
 * transfer — so the fix for a typo doubled the money moved.
 */
export function useUpdateTransfer() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: TablesUpdate<"account_transfers"> }) => {
      const { data, error } = await supabase.from("account_transfers").update(changes).eq("id", id).select().single();
      if (error) throw error;
      return data as AccountTransfer;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteTransfer() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("account_transfers")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
