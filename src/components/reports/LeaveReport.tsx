"use client";

import { useState } from "react";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { useWorkerLeave } from "@/lib/supabase/hooks/useWorkerLeave";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTrialState } from "@/lib/supabase/hooks/useSubscription";
import { aggregateLeave } from "@/lib/payrollReports";
import { shareReport } from "@/lib/docgen/shareReport";
import { buildLeaveReportHTML } from "@/lib/docgen/buildLedgerHTML";
import { openDocumentForPrinting } from "@/lib/docgen/shareDocument";
import { renderPdf, downloadBlob } from "@/lib/docgen/renderPdf";
import { todayStr } from "@/lib/format";

const d = (n: number) => `${n}d`;

// The Leave tab of Payroll Reports — every employee's BCEA position on one page:
// annual accrued against taken, and where sick and family responsibility leave
// stand. The number that matters at year-end and on an exit, in one place.
export function LeaveReport() {
  const { data: staff } = useStaffRegister();
  const { data: leaveRecords } = useWorkerLeave();
  const { data: business } = useBusinessProfile();
  const { isTrialing, isReadOnly } = useTrialState();
  const watermark = isTrialing || isReadOnly;
  const [busy, setBusy] = useState(false);
  const [includeLeft, setIncludeLeft] = useState(false);

  const allStaff = staff ?? [];
  const scoped = includeLeft ? allStaff : allStaff.filter((s) => s.terminated !== true);
  const { rows, totals } = aggregateLeave(scoped, leaveRecords ?? []);

  const pdfRows = rows.map((r) => ({
    name: r.name,
    startDate: r.startDate,
    months: r.balances?.months ?? 0,
    annualAccrued: r.balances?.annualAccrued ?? 0,
    annualTaken: r.balances?.annualTaken ?? 0,
    annualBalance: r.balances?.annualBalance ?? 0,
    sickTaken: r.balances?.sickTaken ?? 0,
    sickBalance: r.balances?.sickBalance ?? 0,
    familyTaken: r.balances?.familyTaken ?? 0,
    familyBalance: r.balances?.familyBalance ?? 0,
    status: r.terminated ? "Left" : "Active",
  }));
  const pdfEntries = rows
    .flatMap((r) => r.entries.map((e) => ({ name: r.name, date: e.date, endDate: e.endDate, type: e.type, days: e.days, note: e.note })))
    .sort((a, b) => b.date.localeCompare(a.date));

  const handlePrint = async () => {
    if (!business || busy) return;
    setBusy(true);
    const asAt = new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
    try {
      const blob = await renderPdf({ kind: "leavereport", rows: pdfRows, entries: pdfEntries, totals, asAt });
      downloadBlob(blob, "leave-report");
    } catch {
      openDocumentForPrinting(buildLeaveReportHTML(business, pdfRows, pdfEntries, totals, asAt, watermark), "leave-report");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = () => {
    const lines = [
      `Days taken — annual ${d(totals.annual)} · sick ${d(totals.sick)} · family ${d(totals.family)}${totals.other > 0 ? ` · other ${d(totals.other)}` : ""}`,
      ``,
      ...rows.map((r) =>
        r.balances
          ? `${r.name} — annual ${d(r.balances.annualBalance)} left (${d(r.balances.annualAccrued)} accrued, ${d(r.balances.annualTaken)} taken) · sick ${d(r.balances.sickBalance)} · family ${d(r.balances.familyBalance)}`
          : `${r.name} — no start date, so nothing accrues yet`
      ),
    ];
    if (rows.length === 0) lines.push("No employees to report on.");
    void shareReport("Leave", `BCEA balances as at ${todayStr()}`, lines, business);
  };

  if (rows.length === 0 && !allStaff.some((s) => s.terminated)) {
    return (
      <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", margin: "40px 0" }}>
        No employees to report on. Contractors accrue no leave.
      </p>
    );
  }

  return (
    <>
      <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 2px 12px" }}>
        Every employee&apos;s BCEA balance: annual accrues 1.25 days a month, sick runs a 30-day 3-year cycle, family is 3 days a year.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 14 }}>
        {[
          { label: "Annual taken", value: d(totals.annual), color: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD" },
          { label: "Sick taken", value: d(totals.sick), color: "#92400e", bg: "#fff7ed", border: "#fed7aa" },
          { label: "Family taken", value: d(totals.family), color: "#0f172a", bg: "#f8fafc", border: "#e2e8f0" },
        ].map((c) => (
          <div key={c.label} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: c.color, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>{c.label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {allStaff.some((s) => s.terminated) && (
        <button
          onClick={() => setIncludeLeft((p) => !p)}
          style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: "#64748b", cursor: "pointer", marginBottom: 14 }}
        >
          {includeLeft ? "✓ Including people who have left" : "Currently employed only"}
        </button>
      )}

      {rows.map((r) => (
        <div key={r.staffId} style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "12px 14px", marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", opacity: r.terminated ? 0.6 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
                {r.name}
                {r.terminated ? <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}> · left</span> : null}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {r.startDate ? `From ${r.startDate} · ${r.balances?.months ?? 0} months` : "No start date on file"}
                {r.totalDays > 0 ? ` · ${d(r.totalDays)} taken in total` : " · no leave recorded"}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: (r.balances?.annualBalance ?? 0) === 0 ? "#be123c" : "#0C4A6E" }}>
                {d(r.balances?.annualBalance ?? 0)}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>annual left</div>
            </div>
          </div>

          {r.balances ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {[
                { label: "Annual", taken: r.balances.annualTaken, left: r.balances.annualBalance, sub: `${d(r.balances.annualAccrued)} accrued` },
                { label: "Sick", taken: r.balances.sickTaken, left: r.balances.sickBalance, sub: "30d / 3yr cycle" },
                { label: "Family", taken: r.balances.familyTaken, left: r.balances.familyBalance, sub: "3d / year" },
              ].map((b) => (
                <div key={b.label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.2, marginBottom: 3 }}>{b.label}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: b.left === 0 ? "#be123c" : "#0C4A6E" }}>{d(b.left)} left</div>
                  <div style={{ fontSize: 9.5, color: "#94a3b8", marginTop: 2 }}>
                    {d(b.taken)} taken · {b.sub}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#b45309" }}>
              Add a start date on the Staff Register — leave accrues from it, so nothing can be calculated without one.
            </div>
          )}
        </div>
      ))}

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
    </>
  );
}
