"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

export type Costing = Tables<"costings">;
// A costing line: a material (qty × unit cost) or labour (qty = hours × rate).
export type CostingLine = { kind: "material" | "labour"; desc: string; qty: number; unit_cost: number };

const QUERY_KEY = ["costings"];

export function useCostings() {
  const supabase = createClient();
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("costings")
        .select("*")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data as Costing[];
    },
  });
}

export function useCreateCosting() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (costing: Omit<TablesInsert<"costings">, "user_id" | "business_id">) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const businessId = await getCurrentBusinessId(supabase);
      const { data, error } = await supabase
        .from("costings")
        .insert({ ...costing, user_id: user.id, business_id: businessId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateCosting() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: TablesUpdate<"costings"> }) => {
      const { data, error } = await supabase.from("costings").update(changes).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
