"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";
import type { Tables } from "@/lib/types/database";

type TaxFiling = Tables<"tax_filings">;

// The statutory returns the app can mark as filed. `filing_type` is a plain
// string column, so widening this union is all it takes to add another return —
// no migration. Each value is the key its own screen filters the history by.
export type FilingType = "vat201" | "emp201" | "emp501" | "uif201" | "coida";

const QUERY_KEY = ["tax_filings"];

export function useTaxFilings() {
  const supabase = createClient();
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("tax_filings").select("*").order("filed_date", { ascending: false });
      if (error) throw error;
      return data as TaxFiling[];
    },
  });
}

export function useMarkFiled() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (filing: { filing_type: FilingType; period_label: string; amount: number }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const businessId = await getCurrentBusinessId(supabase);
      const { data, error } = await supabase
        .from("tax_filings")
        .insert({ ...filing, user_id: user.id, business_id: businessId })
        .select()
        .single();
      if (error) throw error;
      return data as TaxFiling;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// Undo a "mark as filed" — for when the wrong period was ticked, or a pay run
// changed after filing and the total no longer matches. Deletes the marker row
// only; it never touched a real SARS submission, so there's nothing else to
// reverse (unlike voiding a pay run). RLS scopes the delete to the caller's
// business, the same as the insert (policy in 0122).
export function useUnmarkFiled() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // .select() so the deleted rows come back and a no-op is visible. A delete
      // RLS refuses is not an error — PostgREST reports success having removed
      // nothing — so without this the caller's onSuccess fires, the confirmation
      // closes, and the refetch puts the row back still marked as filed. That is
      // exactly what shipped before 0122 added the delete policy; treating an
      // empty result as a failure means a missing policy surfaces instead of
      // being swallowed.
      const { data, error } = await supabase.from("tax_filings").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Couldn't undo the filing — nothing was removed.");
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
