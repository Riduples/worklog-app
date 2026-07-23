"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Whether the signed-in user is a platform admin (may edit national data like the
 * SARS rates). Client courtesy only — for showing/hiding the Admin link; the real
 * boundary is is_platform_admin() in RLS + the requirePlatformAdmin() page gate.
 */
export function useIsPlatformAdmin(): boolean {
  const supabase = createClient();
  const { data } = useQuery({
    queryKey: ["is-platform-admin"],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("is_platform_admin");
      if (error) throw error;
      return Boolean(data);
    },
    staleTime: 60 * 60 * 1000,
  });
  return Boolean(data);
}
