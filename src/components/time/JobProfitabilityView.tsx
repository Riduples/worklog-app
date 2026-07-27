"use client";

import type { TimeEntry } from "@/lib/supabase/hooks/useTimeEntries";
import type { Quote } from "@/lib/supabase/hooks/useQuotes";

// Groups logged time into jobs (by linked quote, or by client when unlinked) and
// compares hours logged vs the hours quoted — an honest hours-vs-hours read, not
// labour rands vs a whole quote total (which would also include materials).
export function JobProfitabilityView({ entries, quotes }: { entries: TimeEntry[]; quotes: Quote[] }) {
  const jobMap = new Map<string, { quote: Quote | null; client: string; hours: number; sessions: number }>();
  for (const e of entries) {
    const key = e.quote_id || `nq-${e.client_name || "—"}`;
    const quote = e.quote_id ? quotes.find((q) => q.id === e.quote_id) ?? null : null;
    const existing = jobMap.get(key);
    if (existing) {
      existing.hours += Number(e.hours_worked || 0);
      existing.sessions += 1;
    } else {
      jobMap.set(key, {
        quote,
        client: e.client_name || quote?.client_name || "—",
        hours: Number(e.hours_worked || 0),
        sessions: 1,
      });
    }
  }

  // Most over-quote first (jobs with no estimate sort to the bottom).
  const jobs = [...jobMap.values()].sort((a, b) => {
    const aOver = a.quote?.estimated_hours ? a.hours - Number(a.quote.estimated_hours) : -1e9;
    const bOver = b.quote?.estimated_hours ? b.hours - Number(b.quote.estimated_hours) : -1e9;
    return bOver - aOver;
  });

  return (
    <>
      <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
        Hours logged vs the hours you quoted, per job. <strong>Red = over your quoted hours.</strong> Set an estimated-hours figure on a quote and link time entries to it.
      </div>

      {jobs.length === 0 && <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", margin: "20px 0" }}>No time logged yet.</p>}

      {jobs.map((job, i) => {
        const quotedHrs = Number(job.quote?.estimated_hours ?? 0);
        const isOver = quotedHrs > 0 && job.hours > quotedHrs;
        const pct = quotedHrs > 0 ? Math.min((job.hours / quotedHrs) * 100, 100) : 0;
        return (
          <div key={i} style={{ background: "#fff", border: `1.5px solid ${isOver ? "#fecdd3" : "#e2e8f0"}`, borderRadius: 14, padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
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
      })}
    </>
  );
}
