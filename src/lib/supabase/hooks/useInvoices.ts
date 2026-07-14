"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

export type Invoice = Tables<"invoices">;

const QUERY_KEY = ["invoices"];

export function useInvoices() {
  const supabase = createClient();
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .is("deleted_at", null)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });
}

export function useCreateInvoice() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoice: Omit<TablesInsert<"invoices">, "user_id" | "business_id">) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const businessId = await getCurrentBusinessId(supabase);
      const { data, error } = await supabase
        .from("invoices")
        .insert({ ...invoice, user_id: user.id, business_id: businessId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}

export function useUpdateInvoice() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: TablesUpdate<"invoices"> }) => {
      const { data, error } = await supabase.from("invoices").update(changes).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useConvertQuoteToInvoice() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      quoteId: string;
      docNumber: string;
      lineItems: Json;
      invoiceAmount: number;
      depositReceived: number;
      vatRate: number | null;
      vatAmount: number;
      issueDate: string;
      dueDate: string | null;
    }) => {
      const { data, error } = await supabase.rpc("convert_quote_to_invoice", {
        p_quote_id: params.quoteId,
        p_doc_number: params.docNumber,
        p_line_items: params.lineItems,
        p_invoice_amount: params.invoiceAmount,
        p_deposit_received: params.depositReceived,
        // Postgres allows NULL for these NUMERIC/DATE params (no NOT NULL
        // constraint), but the generated RPC arg types don't capture that —
        // cast at this boundary rather than fabricate non-null defaults.
        p_vat_rate: params.vatRate as number,
        p_vat_amount: params.vatAmount,
        p_issue_date: params.issueDate,
        p_due_date: params.dueDate as string,
      });
      if (error) throw error;
      return data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}
