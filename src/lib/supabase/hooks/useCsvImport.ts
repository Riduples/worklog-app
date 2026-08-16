"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";
import type { TablesInsert } from "@/lib/types/database";
import type { CsvImportType } from "@/lib/csvTemplates";
import { getNextDocNumbers } from "@/lib/docNumber";

type ImportPayload =
  | { type: "stock"; rows: Omit<TablesInsert<"stock_items">, "user_id" | "business_id">[] }
  | { type: "client" | "supplier"; rows: Omit<TablesInsert<"contacts">, "user_id" | "business_id">[] }
  | { type: "staff"; rows: Omit<TablesInsert<"staff_register">, "user_id" | "business_id">[] };

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

      if (payload.type === "staff") {
        // Employee numbers are assigned here for the same reason the Add form
        // assigns one on save: they're a permanent, per-business sequence.
        // Contractors self-file and never get one, so only the employees in the
        // batch draw from the series.
        const employeeCount = payload.rows.filter((r) => !r.is_contractor).length;
        const numbers = employeeCount > 0 ? await getNextDocNumbers(supabase, businessId, "EMP", employeeCount) : [];
        let next = 0;
        const rows = payload.rows.map((r) => ({
          ...r,
          employee_number: r.is_contractor ? null : numbers[next++],
          user_id: user.id,
          business_id: businessId,
        }));
        const { data, error } = await supabase.from("staff_register").insert(rows).select();
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
      } else if (variables.type === "staff") {
        queryClient.invalidateQueries({ queryKey: ["staff_register"] });
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
      : type === "staff"
        ? (await supabase.from("staff_register").select("name:full_name").is("deleted_at", null)).data
        : (await supabase.from("contacts").select("name").eq("contact_type", type).is("deleted_at", null)).data;
  return new Set((rows ?? []).map((r) => r.name.trim().toLowerCase()));
}
