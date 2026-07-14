"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import type { Permissions } from "@/lib/permissions";

export type BusinessMember = {
  id: string;
  user_id: string;
  email: string;
  role: string;
  permissions: Permissions;
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

export function useUpdateMemberPermissions() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { data: business } = useBusinessProfile();
  return useMutation({
    mutationFn: async ({ memberId, permissions }: { memberId: string; permissions: Permissions }) => {
      const { error } = await supabase.rpc("update_member_permissions", {
        target_member_id: memberId,
        new_permissions: permissions,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business_members", business?.id] }),
  });
}
