"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";
import type { Tables, TablesInsert } from "@/lib/types/database";

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
