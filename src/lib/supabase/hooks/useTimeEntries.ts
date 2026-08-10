"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

export type TimeEntry = Tables<"time_entries">;

const QUERY_KEY = ["time_entries"];

// The real hours an entry represents: base worked plus any overtime. Overtime is
// still time on the job, so every hours total — the list header, the row, and the
// actual-vs-estimate comparison — must count it, exactly as the entry modal does.
// One helper keeps all of them in agreement.
export function loggedHours(entry: Pick<TimeEntry, "hours_worked" | "ot_hours">): number {
  return Number(entry.hours_worked || 0) + Number(entry.ot_hours || 0);
}

export function useTimeEntries() {
  const supabase = createClient();
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .is("deleted_at", null)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data as TimeEntry[];
    },
  });
}

export function useCreateTimeEntry() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Omit<TablesInsert<"time_entries">, "user_id" | "business_id">) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const businessId = await getCurrentBusinessId(supabase);
      const { data, error } = await supabase
        .from("time_entries")
        .insert({ ...entry, user_id: user.id, business_id: businessId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateTimeEntry() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: TablesUpdate<"time_entries"> }) => {
      const { data, error } = await supabase.from("time_entries").update(changes).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
