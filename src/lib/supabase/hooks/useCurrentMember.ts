"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import type { Permissions } from "@/lib/permissions";

export type CurrentMember = { role: string; permissions: Permissions };

// The logged-in user's own membership row for the current business — drives
// every canSee/canView/canEdit/... gate in the UI.
export function useCurrentMember() {
  const supabase = createClient();
  const { data: business } = useBusinessProfile();
  return useQuery({
    queryKey: ["current_member", business?.id],
    enabled: !!business?.id,
    queryFn: async (): Promise<CurrentMember> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("business_members")
        .select("role, permissions")
        .eq("business_id", business!.id)
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return { role: data.role, permissions: (data.permissions as Permissions) ?? {} };
    },
  });
}
