"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// The business's monthly AI (Quick Log) allowance and how much is left, read
// straight from get_ai_quota() so the number shown always matches what the
// route enforces. `unlimited` is true on Structured (and if anything can't be
// resolved) — the modal then shows no counter at all.
export type AiQuota = {
  unlimited: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  reset_at: string | null;
};

export function useAiQuota() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["ai-quota", "quick-log"],
    queryFn: async (): Promise<AiQuota> => {
      const { data, error } = await supabase.rpc("get_ai_quota", { p_route: "quick-log" });
      if (error) throw error;
      return data as unknown as AiQuota;
    },
    staleTime: 30_000,
  });
}
