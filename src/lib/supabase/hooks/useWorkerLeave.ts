"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

export type WorkerLeaveRecord = Tables<"worker_leave">;

const QUERY_KEY = ["worker_leave"];

export function useWorkerLeave() {
  const supabase = createClient();
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("worker_leave").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data as WorkerLeaveRecord[];
    },
  });
}

export function useCreateWorkerLeave() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (leave: Omit<TablesInsert<"worker_leave">, "user_id" | "business_id">) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const businessId = await getCurrentBusinessId(supabase);
      const { data, error } = await supabase
        .from("worker_leave")
        .insert({ ...leave, user_id: user.id, business_id: businessId })
        .select()
        .single();
      if (error) throw error;
      return data as WorkerLeaveRecord;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// Manually-recorded leave only — leave booked by a pay run belongs to that run and
// is reversed by voiding it (RLS in 0118 holds the same line). Hard delete:
// worker_leave has no deleted_at, and the BCEA balances are recomputed from the
// rows that remain, so removing one simply takes those days back out.
export function useDeleteWorkerLeave() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // .select() so an RLS-blocked delete (0 rows, no error) is reported rather
      // than passing silently as a success the list would then contradict.
      const { data, error } = await supabase.from("worker_leave").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Couldn't delete this leave entry — it may already be gone, or you no longer have permission.");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// Manually-recorded leave only — "from Pay Run" entries are synthesized and never edited here.
export function useUpdateWorkerLeave() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: TablesUpdate<"worker_leave"> }) => {
      const { data, error } = await supabase.from("worker_leave").update(changes).eq("id", id).select().single();
      if (error) throw error;
      return data as WorkerLeaveRecord;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
