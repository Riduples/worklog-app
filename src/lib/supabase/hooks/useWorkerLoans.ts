"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

export type WorkerLoan = Tables<"worker_loans">;

const QUERY_KEY = ["worker_loans"];

export function useWorkerLoans() {
  const supabase = createClient();
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("worker_loans").select("*").order("entry_date", { ascending: false });
      if (error) throw error;
      return data as WorkerLoan[];
    },
  });
}

// Advances only — repayments are only ever created atomically via the
// create_pay_run RPC when a loan is deducted from wages.
export function useCreateAdvance() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      loan: Omit<TablesInsert<"worker_loans">, "user_id" | "business_id" | "loan_type">
    ) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const businessId = await getCurrentBusinessId(supabase);
      const { data, error } = await supabase
        .from("worker_loans")
        .insert({ ...loan, loan_type: "advance", user_id: user.id, business_id: businessId })
        .select()
        .single();
      if (error) throw error;
      return data as WorkerLoan;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// Advances only — a repayment belongs to the pay run that created it and is
// removed by voiding that run, not from here (RLS in 0118 holds the same line).
// Hard delete: worker_loans has no deleted_at, and the outstanding balance is
// recomputed from the rows that remain, so removing one simply takes it out.
export function useDeleteAdvance() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // .select() so an RLS-blocked delete (0 rows, no error) is reported rather
      // than passing silently as a success the list would then contradict.
      const { data, error } = await supabase.from("worker_loans").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Couldn't delete this advance — it may already be gone, or you no longer have permission.");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// Advances only — repayment rows come from Pay Run and are never edited here.
export function useUpdateAdvance() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: TablesUpdate<"worker_loans"> }) => {
      const { data, error } = await supabase.from("worker_loans").update(changes).eq("id", id).select().single();
      if (error) throw error;
      return data as WorkerLoan;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
