"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";
import type { Tables } from "@/lib/types/database";

export type LogbookYear = Tables<"mileage_logbook_years">;

const QUERY_KEY = ["mileage_logbook_years"];

// The annual opening/closing odometer readings, one row per SA tax year. Total km
// for the year is closing - opening, read where it's needed rather than stored.
export function useLogbookYears() {
  const supabase = createClient();
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mileage_logbook_years")
        .select("*")
        .order("tax_year_start", { ascending: false });
      if (error) throw error;
      return data as LogbookYear[];
    },
  });
}

// One row per business per tax year — save is an upsert keyed on that pair, so
// re-saving a year updates its readings instead of spawning a duplicate.
export function useUpsertLogbookYear() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tax_year_start: string;
      opening_odometer: number | null;
      closing_odometer: number | null;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const businessId = await getCurrentBusinessId(supabase);
      const { data, error } = await supabase
        .from("mileage_logbook_years")
        .upsert({ ...input, user_id: user.id, business_id: businessId }, { onConflict: "business_id,tax_year_start" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
