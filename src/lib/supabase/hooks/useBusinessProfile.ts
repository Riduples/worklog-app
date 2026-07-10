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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data as BusinessProfile;
    },
  });
}
