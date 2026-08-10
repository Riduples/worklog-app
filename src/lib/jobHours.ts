import { loggedHours, type TimeEntry } from "@/lib/supabase/hooks/useTimeEntries";
import type { Quote } from "@/lib/supabase/hooks/useQuotes";

export type JobStatus = "over" | "near" | "ontrack" | "none";

// A job's time rolled up for the Actual vs Estimate report: the hours quoted (from
// the linked quote's estimate) against the hours actually logged, split into
// billable and non-billable so an over-run can be judged — bill it or absorb it.
export type JobHours = {
  key: string;
  quote: Quote | null;
  client: string;
  quotedHours: number;
  billableHours: number;
  nonBillableHours: number;
  totalHours: number;
  sessions: number;
  hasEstimate: boolean;
  overBy: number; // hours past the quote (0 when within, or no estimate)
  remaining: number; // hours left before the quote (0 when over, or no estimate)
  status: JobStatus;
};

// "Near" once you've burned this share of the quoted hours but aren't over yet.
const NEAR_THRESHOLD = 0.8;

// Group time entries into jobs (by linked quote, else by client) and compare
// logged hours against the quote's estimate. Overtime counts as hours (loggedHours);
// billable vs non-billable is split by each entry's bill_type. Pure — the report
// renders whatever this returns, and it's unit-tested.
export function aggregateJobHours(entries: TimeEntry[], quotes: Quote[]): JobHours[] {
  const map = new Map<string, JobHours>();

  for (const e of entries) {
    const key = e.quote_id || `nq-${e.client_name || "—"}`;
    const quote = e.quote_id ? quotes.find((q) => q.id === e.quote_id) ?? null : null;
    let job = map.get(key);
    if (!job) {
      const quotedHours = Number(quote?.estimated_hours ?? 0);
      job = {
        key,
        quote,
        client: e.client_name || quote?.client_name || "—",
        quotedHours,
        billableHours: 0,
        nonBillableHours: 0,
        totalHours: 0,
        sessions: 0,
        hasEstimate: quotedHours > 0,
        overBy: 0,
        remaining: 0,
        status: "none",
      };
      map.set(key, job);
    }
    const h = loggedHours(e);
    if (e.bill_type === "Billable") job.billableHours += h;
    else job.nonBillableHours += h;
    job.totalHours += h;
    job.sessions += 1;
  }

  const jobs = [...map.values()];
  for (const j of jobs) {
    if (!j.hasEstimate) continue;
    j.overBy = Math.max(0, j.totalHours - j.quotedHours);
    j.remaining = Math.max(0, j.quotedHours - j.totalHours);
    j.status = j.totalHours > j.quotedHours ? "over" : j.totalHours / j.quotedHours >= NEAR_THRESHOLD ? "near" : "ontrack";
  }

  // Over first (biggest overage), then near, on-track, and finally no-estimate
  // jobs; ties broken by most hours logged.
  const rank: Record<JobStatus, number> = { over: 0, near: 1, ontrack: 2, none: 3 };
  return jobs.sort((a, b) => rank[a.status] - rank[b.status] || b.overBy - a.overBy || b.totalHours - a.totalHours);
}
