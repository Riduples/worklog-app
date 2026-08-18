"use client";

import { useState } from "react";
import { useTimeEntries } from "@/lib/supabase/hooks/useTimeEntries";
import { useQuotes } from "@/lib/supabase/hooks/useQuotes";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTrialState } from "@/lib/supabase/hooks/useSubscription";
import { aggregateJobHours, type JobHours, type JobStatus } from "@/lib/jobHours";
import { shareReport } from "@/lib/docgen/shareReport";
import { buildActualVsEstimateHTML } from "@/lib/docgen/buildLedgerHTML";
import { openDocumentForPrinting } from "@/lib/docgen/shareDocument";
import { renderPdf, downloadBlob } from "@/lib/docgen/renderPdf";
import { ExportCsvButton } from "@/components/reports/ReportShell";
import { todayStr } from "@/lib/format";

const STATUS_META: Record<JobStatus, { badge: string; bg: string; border: string; text: string; bar: string }> = {
  over: { badge: "⚠️ Over", bg: "#fff1f2", border: "#fecdd3", text: "#be123c", bar: "#ef4444" },
  near: { badge: "⚡ Near limit", bg: "#fffbeb", border: "#fde68a", text: "#92400e", bar: "#f59e0b" },
  ontrack: { badge: "✅ On track", bg: "#F0F9FF", border: "#BAE6FD", text: "#0369A1", bar: "#0C4A6E" },
  none: { badge: "— No estimate", bg: "#f8fafc", border: "#e2e8f0", text: "#64748b", bar: "#94a3b8" },
};
const STATUS_LABEL: Record<JobStatus, string> = { over: "Over", near: "Near limit", ontrack: "On track", none: "No estimate" };

const fmtH = (h: number) => `${h.toFixed(1)}h`;

// The Hours-vs-Estimate tab of the Time & Travel Reports tool. Per job it shows
// the hours quoted against the hours logged, whether it's over, and the billable
// / non-billable split so an over-run can be judged — bill it or absorb it.
export function HoursVsEstimateReport() {
  const { data: entries } = useTimeEntries();
  const { data: quotes } = useQuotes();
  const { data: business } = useBusinessProfile();
  const { isTrialing, isReadOnly } = useTrialState();
  const watermark = isTrialing || isReadOnly;
  const [busy, setBusy] = useState(false);

  const jobs = aggregateJobHours(entries ?? [], quotes ?? []);
  const withEstimate = jobs.filter((j) => j.hasEstimate);
  const other = jobs.filter((j) => !j.hasEstimate);

  const totalQuoted = withEstimate.reduce((s, j) => s + j.quotedHours, 0);
  const totalLogged = withEstimate.reduce((s, j) => s + j.totalHours, 0);
  const totalOver = withEstimate.reduce((s, j) => s + j.overBy, 0);
  const overCount = withEstimate.filter((j) => j.status === "over").length;

  const pdfRows = withEstimate.map((j) => ({
    client: j.client,
    reference: j.quote?.doc_number ?? "",
    quotedHours: j.quotedHours,
    loggedHours: j.totalHours,
    billableHours: j.billableHours,
    nonBillableHours: j.nonBillableHours,
    overBy: j.overBy,
    remaining: j.remaining,
    status: STATUS_LABEL[j.status],
  }));
  const pdfOther = other.map((j) => ({ client: j.client, loggedHours: j.totalHours, billableHours: j.billableHours, nonBillableHours: j.nonBillableHours }));
  const pdfTotals = { quoted: totalQuoted, logged: totalLogged, over: totalOver };

  const handlePrint = async () => {
    if (!business || busy) return;
    setBusy(true);
    const asAt = new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
    try {
      const blob = await renderPdf({ kind: "actualvsestimate", rows: pdfRows, other: pdfOther, totals: pdfTotals, asAt });
      downloadBlob(blob, "actual-vs-estimate");
    } catch {
      openDocumentForPrinting(buildActualVsEstimateHTML(business, pdfRows, pdfOther, pdfTotals, asAt, watermark), "actual-vs-estimate");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = () => {
    const lines: string[] = [];
    for (const j of withEstimate) {
      const doc = j.quote?.doc_number ? `${j.quote.doc_number} · ` : "";
      const verdict = j.status === "over" ? `OVER by ${fmtH(j.overBy)}` : `${fmtH(j.remaining)} left`;
      lines.push(
        `${j.client} (${doc}${fmtH(j.totalHours)} of ${fmtH(j.quotedHours)}) — ${verdict}`,
        `   billable ${fmtH(j.billableHours)} · non-billable ${fmtH(j.nonBillableHours)}`
      );
    }
    if (!lines.length) lines.push("No quoted jobs with linked time yet.");
    void shareReport("Actual vs Estimate", `Hours vs quote · as at ${todayStr()}`, lines, business);
  };

  const card = (j: JobHours) => {
    const m = STATUS_META[j.status];
    const pct = j.quotedHours > 0 ? Math.min((j.totalHours / j.quotedHours) * 100, 100) : 0;
    return (
      <div key={j.key} style={{ background: "#fff", border: `1.5px solid ${m.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{j.client}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {j.quote ? j.quote.doc_number : "No quote"} · {j.sessions} session{j.sessions !== 1 ? "s" : ""}
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, background: m.bg, color: m.text, padding: "3px 8px", borderRadius: 8, border: `1px solid ${m.border}`, whiteSpace: "nowrap" }}>{m.badge}</span>
        </div>

        {j.hasEstimate && (
          <>
            <div style={{ background: "#f1f5f9", borderRadius: 6, height: 8, marginBottom: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: m.bar, borderRadius: 6 }} />
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
              {fmtH(j.totalHours)} of {fmtH(j.quotedHours)} quoted
              {j.status === "over" ? (
                <strong style={{ color: m.text }}> — over by {fmtH(j.overBy)}</strong>
              ) : (
                ` — ${fmtH(j.remaining)} left`
              )}
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0369A1", textTransform: "uppercase", letterSpacing: 0.3 }}>Billable</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0369A1" }}>{fmtH(j.billableHours)}</div>
          </div>
          <div style={{ flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.3 }}>Non-billable</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#64748b" }}>{fmtH(j.nonBillableHours)}</div>
          </div>
        </div>

        {j.status === "over" && (
          <div style={{ fontSize: 11, color: m.text, marginTop: 8 }}>
            {fmtH(j.overBy)} over quote — decide whether to bill the extra or absorb it.
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {withEstimate.length > 0 && (
        <>
          <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 2px 12px" }}>
            Each job&apos;s total hours to date against the hours quoted for it.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 14 }}>
            {[
              { label: "Quoted", value: totalQuoted, color: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD" },
              { label: "Logged", value: totalLogged, color: "#0f172a", bg: "#f8fafc", border: "#e2e8f0" },
              { label: "Over", value: totalOver, color: totalOver > 0 ? "#be123c" : "#0369A1", bg: totalOver > 0 ? "#fff1f2" : "#F0F9FF", border: totalOver > 0 ? "#fecdd3" : "#BAE6FD" },
            ].map((c) => (
              <div key={c.label} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: c.color, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>{c.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: c.color }}>{fmtH(c.value)}</div>
              </div>
            ))}
          </div>

          <div style={{ background: overCount > 0 ? "#fff1f2" : "#F0F9FF", border: `1.5px solid ${overCount > 0 ? "#fecdd3" : "#BAE6FD"}`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{overCount > 0 ? "Jobs over quoted hours" : "All jobs within quote"}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{withEstimate.length} quoted job{withEstimate.length !== 1 ? "s" : ""} with linked time</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: overCount > 0 ? "#be123c" : "#0369A1" }}>{overCount}</div>
          </div>
        </>
      )}

      {jobs.length === 0 && <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", margin: "40px 0" }}>No time logged yet.</p>}

      {jobs.length > 0 && withEstimate.length === 0 && (
        <div style={{ background: "#fff", border: "1.5px dashed #cbd5e1", borderRadius: 14, padding: "18px 16px", marginBottom: 16, fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color: "#0C4A6E", marginBottom: 4 }}>Nothing to compare yet</div>
          Set an <strong>estimated-hours</strong> figure on a quote, then link your time entries to that quote — each job&apos;s actual-vs-quoted appears here.
        </div>
      )}

      {withEstimate.map(card)}

      {other.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.4, margin: `${withEstimate.length > 0 ? "20px" : "0"} 2px 8px` }}>
            Other logged time — no estimate to compare
          </div>
          {other.map(card)}
        </>
      )}

      {jobs.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            onClick={handlePrint}
            disabled={!business || busy}
            style={{ flex: 1, background: "#F0F9FF", color: "#0C4A6E", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            {busy ? "📄 Preparing..." : "📄 Download PDF"}
          </button>
          <button
            onClick={handleShare}
            style={{ flex: 1, background: "#F0F9FF", color: "#0C4A6E", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            📤 Share
          </button>
        </div>
      )}
      {jobs.length > 0 && (
        <ExportCsvButton
          style={{ marginTop: 10 }}
          csv={() => ({
            filename: "actual-vs-estimate",
            headers: ["Client", "Reference", "Quoted hours", "Logged hours", "Billable hours", "Non-billable hours", "Over by", "Remaining", "Status"],
            rows: [
              ...pdfRows.map((r) => [r.client, r.reference, r.quotedHours, r.loggedHours, r.billableHours, r.nonBillableHours, r.overBy, r.remaining, r.status]),
              ...pdfOther.map((r) => [r.client, "", "", r.loggedHours, r.billableHours, r.nonBillableHours, "", "", "No estimate"]),
            ],
          })}
        />
      )}
    </>
  );
}
