"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables, TablesUpdate } from "@/lib/types/database";
import type { Plan } from "@/lib/tiers";

export type BusinessProfile = Tables<"business_profiles">;

export function useBusinessProfile() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["business_profile"],
    queryFn: async () => {
      // No explicit filter — RLS (business membership) scopes this to the
      // caller's own business, so this also works for invited members whose
      // own user_id doesn't match business_profiles.user_id (the owner's).
      const { data, error } = await supabase.from("business_profiles").select("*").single();
      if (error) throw error;
      return data as BusinessProfile;
    },
  });
}

export function useUpdateBusinessPlan() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ businessId, plan }: { businessId: string; plan: Plan }) => {
      const { error } = await supabase.rpc("update_business_plan", {
        target_business_id: businessId,
        new_plan: plan,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business_profile"] }),
  });
}

export function useUpdateBusinessProfile() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: TablesUpdate<"business_profiles"> }) => {
      const { data, error } = await supabase.from("business_profiles").update(changes).eq("id", id).select().single();
      if (error) throw error;
      return data as BusinessProfile;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business_profile"] }),
  });
}
