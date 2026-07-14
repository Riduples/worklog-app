"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";

export type BusinessMember = {
  id: string;
  user_id: string;
  email: string;
  role: string;
  permissions: unknown;
  created_at: string;
};

export function useBusinessMembers() {
  const supabase = createClient();
  const { data: business } = useBusinessProfile();
  return useQuery({
    queryKey: ["business_members", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_business_members", {
        target_business_id: business!.id,
      });
      if (error) throw error;
      return data as BusinessMember[];
    },
  });
}
