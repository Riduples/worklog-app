"use client";

import { loggedHours, type TimeEntry } from "@/lib/supabase/hooks/useTimeEntries";
import type { Quote } from "@/lib/supabase/hooks/useQuotes";

type Job = { quote: Quote | null; client: string; hours: number; sessions: number };

// Groups logged time into jobs (by linked quote, or by client when unlinked) and
// compares hours logged vs the hours quoted — an honest hours-vs-hours read, not
// labour rands vs a whole quote total (which would also include materials).
export function JobProfitabilityView({ entries, quotes }: { entries: TimeEntry[]; quotes: Quote[] }) {
  const jobMap = new Map<string, Job>();
  for (const e of entries) {
    const key = e.quote_id || `nq-${e.client_name || "—"}`;
    const quote = e.quote_id ? quotes.find((q) => q.id === e.quote_id) ?? null : null;
    const existing = jobMap.get(key);
    if (existing) {
      // Count overtime too — it's still time on the job (see loggedHours).
      existing.hours += loggedHours(e);
      existing.sessions += 1;
    } else {
      jobMap.set(key, {
        quote,
        client: e.client_name || quote?.client_name || "—",
        hours: loggedHours(e),
        sessions: 1,
      });
    }
  }

  const allJobs = [...jobMap.values()];
  const estOf = (j: Job) => Number(j.quote?.estimated_hours ?? 0);

  // Only jobs whose quote carries an estimated-hours figure can actually be
  // compared; the rest is just logged time with nothing to measure against, so it
  // sits in its own muted group below and the comparison stays legible. Comparable
  // jobs sort most-over-quote first; the rest by most hours.
  const comparable = allJobs.filter((j) => estOf(j) > 0).sort((a, b) => b.hours - estOf(b) - (a.hours - estOf(a)));
  const other = allJobs.filter((j) => estOf(j) <= 0).sort((a, b) => b.hours - a.hours);

  const card = (job: Job, key: string) => {
    const quotedHrs = estOf(job);
    const isOver = quotedHrs > 0 && job.hours > quotedHrs;
    const pct = quotedHrs > 0 ? Math.min((job.hours / quotedHrs) * 100, 100) : 0;
    return (
      <div key={key} style={{ background: "#fff", border: `1.5px solid ${isOver ? "#fecdd3" : "#e2e8f0"}`, borderRadius: 14, padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: quotedHrs > 0 ? 8 : 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{job.client}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {job.quote ? job.quote.doc_number : "No quote"} · {job.hours.toFixed(1)}h logged · {job.sessions} session{job.sessions !== 1 ? "s" : ""}
            </div>
          </div>
          {isOver && <span style={{ fontSize: 11, fontWeight: 700, background: "#fee2e2", color: "#be123c", padding: "3px 8px", borderRadius: 8 }}>⚠️ Over</span>}
          {!isOver && quotedHrs > 0 && <span style={{ fontSize: 11, fontWeight: 700, background: "#F0F9FF", color: "#0369A1", padding: "3px 8px", borderRadius: 8 }}>✅ OK</span>}
        </div>
        {quotedHrs > 0 && (
          <>
            <div style={{ background: "#f1f5f9", borderRadius: 6, height: 8, marginBottom: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: isOver ? "#ef4444" : "#0C4A6E", borderRadius: 6 }} />
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {job.hours.toFixed(1)}h of {quotedHrs.toFixed(1)}h quoted
              {isOver ? (
                <strong style={{ color: "#be123c" }}> — over by {(job.hours - quotedHrs).toFixed(1)}h</strong>
              ) : (
                ` — ${(quotedHrs - job.hours).toFixed(1)}h left`
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
        Hours logged (including overtime) vs the hours you quoted, per job. <strong>Red = over your quoted hours.</strong>
      </div>

      {allJobs.length === 0 && <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", margin: "20px 0" }}>No time logged yet.</p>}

      {/* Nothing to compare against — tell the user how to make the view work
          rather than showing a wall of bar-less cards. */}
      {allJobs.length > 0 && comparable.length === 0 && (
        <div style={{ background: "#fff", border: "1.5px dashed #cbd5e1", borderRadius: 14, padding: "18px 16px", marginBottom: 16, fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color: "#0C4A6E", marginBottom: 4 }}>Nothing to compare yet</div>
          Set an <strong>estimated-hours</strong> figure on a quote, then link your time entries to that quote — the actual-vs-quoted bars appear here once you do.
        </div>
      )}

      {comparable.map((job, i) => card(job, `cmp-${i}`))}

      {other.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.4, margin: `${comparable.length > 0 ? "20px" : "0"} 2px 8px` }}>
            Other logged time — no estimate to compare
          </div>
          {other.map((job, i) => card(job, `oth-${i}`))}
        </>
      )}
    </>
  );
}
