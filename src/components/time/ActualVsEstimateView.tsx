"use client";

import { useTimeEntries } from "@/lib/supabase/hooks/useTimeEntries";
import { useQuotes } from "@/lib/supabase/hooks/useQuotes";
import { JobProfitabilityView } from "@/components/time/JobProfitabilityView";
import { BackLink } from "@/components/ui/BackLink";

// Standalone Scheduling report — the hours-vs-quote comparison, lifted out of the
// Time Tracker screen into its own subtool (like Age Analysis sits beside its
// list). Reads the same time entries and quotes; the comparison logic lives in
// JobProfitabilityView.
export function ActualVsEstimateView() {
  const { data: entries } = useTimeEntries();
  const { data: quotes } = useQuotes();

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <BackLink label="Time Tracker" href="/time" />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>Actual vs Estimate</h1>
      <JobProfitabilityView entries={entries ?? []} quotes={quotes ?? []} />
    </div>
  );
}
