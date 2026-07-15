"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";
import type { Tables } from "@/lib/types/database";

export type TaxFiling = Tables<"tax_filings">;

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
    mutationFn: async (filing: { filing_type: "vat201" | "emp201"; period_label: string; amount: number }) => {
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
