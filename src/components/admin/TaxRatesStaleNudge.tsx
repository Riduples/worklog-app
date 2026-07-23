"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { todayStr } from "@/lib/format";
import { useIsPlatformAdmin } from "@/lib/supabase/hooks/usePlatformAdmin";

/**
 * Shown on the dashboard to platform admins ONLY, and only when no tax_rates row
 * covers today's date — i.e. a new tax year has started and its SARS figures
 * haven't been entered, so the app is silently running on its hardcoded fallback.
 * This is the "always latest" safety net: there's no SARS feed to fetch from, so
 * instead the person who can fix it is reminded the moment the rates go stale.
 */
export function TaxRatesStaleNudge() {
  const isAdmin = useIsPlatformAdmin();
  const supabase = createClient();
  const { data: covered } = useQuery({
    queryKey: ["tax-rates-coverage"],
    queryFn: async (): Promise<boolean> => {
      const today = todayStr();
      const { data, error } = await supabase
        .from("tax_rates")
        .select("id")
        .lte("effective_from", today)
        .gte("effective_to", today)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: isAdmin,
    staleTime: 60 * 60 * 1000,
  });

  // Only nudge once we KNOW there's no coverage (covered === false); stay quiet
  // while loading or for non-admins.
  if (!isAdmin || covered !== false) return null;

  return (
    <Link
      href="/admin/tax-rates"
      style={{ display: "block", margin: "12px 16px 0", background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: 14, padding: "12px 16px", textDecoration: "none" }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, color: "#991B1B" }}>⚠️ SARS rates need updating</div>
      <div style={{ fontSize: 12, color: "#7F1D1D", marginTop: 2, lineHeight: 1.5 }}>
        No rate table covers the current tax year — the app is on its built-in fallback. Tap to add this year&apos;s SARS
        figures.
      </div>
    </Link>
  );
}
