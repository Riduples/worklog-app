"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

export type StaffMember = Tables<"staff_register">;

const QUERY_KEY = ["staff_register"];

export function useStaffRegister() {
  const supabase = createClient();
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_register")
        .select("*")
        .is("deleted_at", null)
        .order("full_name");
      if (error) throw error;
      return data as StaffMember[];
    },
  });
}

export function useCreateStaffMember() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (member: Omit<TablesInsert<"staff_register">, "user_id" | "business_id">) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const businessId = await getCurrentBusinessId(supabase);
      const { data, error } = await supabase
        .from("staff_register")
        .insert({ ...member, user_id: user.id, business_id: businessId })
        .select()
        .single();
      if (error) throw error;
      return data as StaffMember;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateStaffMember() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: TablesUpdate<"staff_register"> }) => {
      const { data, error } = await supabase.from("staff_register").update(changes).eq("id", id).select().single();
      if (error) throw error;
      return data as StaffMember;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
