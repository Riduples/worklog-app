"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database";

export type Subscription = Tables<"subscriptions">;

const DAY_MS = 86_400_000;

/**
 * The current business's subscription row, if any. RLS scopes it to the caller's
 * own business. Older accounts (created before the trial trigger) have no row —
 * hence maybeSingle and the null handling in useTrialState.
 */
export function useSubscription() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["subscription"],
    queryFn: async (): Promise<Subscription | null> => {
      const { data, error } = await supabase.from("subscriptions").select("*").maybeSingle();
      if (error) throw error;
      return (data as Subscription) ?? null;
    },
  });
}

export type TrialState = {
  loading: boolean;
  /** On an active trial (not yet expired). */
  isTrialing: boolean;
  /** Whole days left in the trial, rounded up; null when not trialing. */
  trialDaysLeft: number | null;
  /**
   * The business is read-only: an expired trial, or a lapsed/paused subscription
   * (Phase 2). Mirrors business_is_writable() in the DB — the server is the real
   * boundary, this only decides what to show and disable.
   */
  isReadOnly: boolean;
  /** Convenience: may this business create/edit/delete right now? */
  canWrite: boolean;
};

/**
 * Read-only = an explicit read_only status, or a trial run past its end. Pure and
 * React-free so the global mutation-error interceptor (QueryProvider) can reuse it
 * to recognise a write that was blocked because the business has lapsed.
 */
export function isReadOnlySubscription(sub: Subscription | null | undefined): boolean {
  if (!sub) return false;
  const end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  return sub.status === "read_only" || (sub.status === "trialing" && end != null && end <= Date.now());
}

export function useTrialState(): TrialState {
  const { data: sub, isLoading } = useSubscription();
  const now = Date.now();
  const end = sub?.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const isReadOnly = isReadOnlySubscription(sub);
  const isTrialing = sub?.status === "trialing" && !isReadOnly;
  const trialDaysLeft = isTrialing && end != null ? Math.max(0, Math.ceil((end - now) / DAY_MS)) : null;
  return { loading: isLoading, isTrialing, trialDaysLeft, isReadOnly, canWrite: !isReadOnly };
}
