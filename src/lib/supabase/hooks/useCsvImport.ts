"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";
import type { TablesInsert } from "@/lib/types/database";
import type { CsvImportType } from "@/lib/csvTemplates";

type ImportPayload =
  | { type: "stock"; rows: Omit<TablesInsert<"stock_items">, "user_id" | "business_id">[] }
  | { type: "client" | "supplier"; rows: Omit<TablesInsert<"contacts">, "user_id" | "business_id">[] };

export function useCsvImport() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ImportPayload) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const businessId = await getCurrentBusinessId(supabase);

      if (payload.type === "stock") {
        const { data, error } = await supabase
          .from("stock_items")
          .insert(payload.rows.map((r) => ({ ...r, user_id: user.id, business_id: businessId })))
          .select();
        if (error) throw error;
        return data.length;
      }

      const { data, error } = await supabase
        .from("contacts")
        .insert(payload.rows.map((r) => ({ ...r, user_id: user.id, business_id: businessId })))
        .select();
      if (error) throw error;
      return data.length;
    },
    onSuccess: (_count, variables) => {
      if (variables.type === "stock") {
        queryClient.invalidateQueries({ queryKey: ["stock_items"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
      }
    },
  });
}

// Fetches existing names (case-insensitive keys) for dedup, without going through
// the cached list hooks so it's always fresh at import time.
export async function fetchExistingNames(type: CsvImportType): Promise<Set<string>> {
  const supabase = createClient();
  const rows =
    type === "stock"
      ? (await supabase.from("stock_items").select("name").is("deleted_at", null)).data
      : (await supabase.from("contacts").select("name").eq("contact_type", type).is("deleted_at", null)).data;
  return new Set((rows ?? []).map((r) => r.name.trim().toLowerCase()));
}
