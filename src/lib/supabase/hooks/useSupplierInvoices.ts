"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

export type SupplierInvoice = Tables<"supplier_invoices">;

const QUERY_KEY = ["supplier_invoices"];

export function useSupplierInvoices() {
  const supabase = createClient();
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_invoices")
        .select("*")
        .is("deleted_at", null)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data as SupplierInvoice[];
    },
  });
}

export function useCreateSupplierInvoice() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (si: Omit<TablesInsert<"supplier_invoices">, "user_id">) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("supplier_invoices")
        .insert({ ...si, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateSupplierInvoice() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: TablesUpdate<"supplier_invoices"> }) => {
      const { data, error } = await supabase.from("supplier_invoices").update(changes).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
