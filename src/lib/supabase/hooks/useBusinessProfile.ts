"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database";

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
