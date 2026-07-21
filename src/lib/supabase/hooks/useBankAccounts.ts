"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

export type BankAccount = Tables<"bank_accounts">;

const QUERY_KEY = ["bank_accounts"];

export function useBankAccounts() {
  const supabase = createClient();
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as BankAccount[];
    },
  });
}

// A partial unique index allows at most one default per business, so the current
// default has to be cleared before another is set — otherwise the insert/update
// trips the constraint.
async function clearDefault(supabase: ReturnType<typeof createClient>, businessId: string) {
  await supabase
    .from("bank_accounts")
    .update({ is_default: false })
    .eq("business_id", businessId)
    .eq("is_default", true)
    .is("deleted_at", null);
}

export function useCreateBankAccount() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (account: Omit<TablesInsert<"bank_accounts">, "user_id" | "business_id">) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const businessId = await getCurrentBusinessId(supabase);
      if (account.is_default) await clearDefault(supabase, businessId);
      const { data, error } = await supabase
        .from("bank_accounts")
        .insert({ ...account, user_id: user.id, business_id: businessId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateBankAccount() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: TablesUpdate<"bank_accounts"> }) => {
      if (changes.is_default) {
        const businessId = await getCurrentBusinessId(supabase);
        await clearDefault(supabase, businessId);
      }
      const { data, error } = await supabase
        .from("bank_accounts")
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteBankAccount() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    // Soft delete, and drop the default flag so the partial unique index stays
    // free and the account disappears from every picker. Its tagged transactions
    // keep pointing at it (they still count under "All accounts").
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bank_accounts")
        .update({ deleted_at: new Date().toISOString(), is_default: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
