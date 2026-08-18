"use client";

import { useState } from "react";
import { useWorkerLoans } from "@/lib/supabase/hooks/useWorkerLoans";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTrialState } from "@/lib/supabase/hooks/useSubscription";
import { aggregateAdvances } from "@/lib/payrollReports";
import { shareReport } from "@/lib/docgen/shareReport";
import { buildAdvancesReportHTML } from "@/lib/docgen/buildLedgerHTML";
import { openDocumentForPrinting } from "@/lib/docgen/shareDocument";
import { renderPdf, downloadBlob } from "@/lib/docgen/renderPdf";
import { ExportCsvButton } from "@/components/reports/ReportShell";
import { fmt, todayStr } from "@/lib/format";

// The Advances tab of Payroll Reports — who has been given what, what Pay Run has
// taken back, and what is still owed. The Advances dashboard is the running list
// of entries; this is the per-person position the entries add up to.
export function AdvancesReport() {
  const { data: loans } = useWorkerLoans();
  const { data: business } = useBusinessProfile();
  const { isTrialing, isReadOnly } = useTrialState();
  const watermark = isTrialing || isReadOnly;
  const [busy, setBusy] = useState(false);
  const [owingOnly, setOwingOnly] = useState(false);

  const { rows: allRows, totals } = aggregateAdvances(loans ?? []);
  const rows = owingOnly ? allRows.filter((r) => r.balance > 0) : allRows;

  const pdfRows = rows.map((r) => ({
    name: r.name,
    advanced: r.advanced,
    repaid: r.repaid,
    balance: r.balance,
    repayPerRun: r.repayPerRun,
    runsLeft: r.runsLeft,
  }));
  // The entry log is flattened newest-first across everyone, so the printed copy
  // reads as a ledger rather than a person-by-person retelling.
  const pdfEntries = rows
    .flatMap((r) => r.entries.map((e) => ({ name: r.name, date: e.date, type: e.type === "advance" ? "Advance given" : "Repaid from wages", amount: e.amount, note: e.note })))
    .sort((a, b) => b.date.localeCompare(a.date));

  const handlePrint = async () => {
    if (!business || busy) return;
    setBusy(true);
    const asAt = new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
    try {
      const blob = await renderPdf({ kind: "advancesreport", rows: pdfRows, entries: pdfEntries, totals, asAt });
      downloadBlob(blob, "advances-report");
    } catch {
      openDocumentForPrinting(buildAdvancesReportHTML(business, pdfRows, pdfEntries, totals, asAt, watermark), "advances-report");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = () => {
    const lines = [
      `Advanced: ${fmt(totals.advanced)}`,
      `Repaid: ${fmt(totals.repaid)}`,
      `Still owed: ${fmt(totals.outstanding)} by ${totals.people} ${totals.people === 1 ? "person" : "people"}`,
      ``,
      ...rows.map(
        (r) =>
          `${r.name} — ${fmt(r.balance)} owing (advanced ${fmt(r.advanced)}, repaid ${fmt(r.repaid)})${
            r.repayPerRun > 0 ? ` · ${fmt(r.repayPerRun)}/run${r.runsLeft ? `, ~${r.runsLeft} runs left` : ""}` : ""
          }`
      ),
    ];
    if (rows.length === 0) lines.push("No advances recorded.");
    void shareReport("Advances", `As at ${todayStr()}`, lines, business);
  };

  if (allRows.length === 0) {
    return <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", margin: "40px 0" }}>No advances recorded yet.</p>;
  }

  return (
    <>
      <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 2px 12px" }}>
        What each person was advanced, what Pay Run has deducted, and what&apos;s left to recover.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
        {[
          { label: "Advanced", value: fmt(totals.advanced), color: "#0f172a", bg: "#f8fafc", border: "#e2e8f0" },
          { label: "Repaid", value: fmt(totals.repaid), color: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD" },
          { label: "Outstanding", value: fmt(totals.outstanding), color: "#92400e", bg: "#fff7ed", border: "#fed7aa" },
        ].map((c) => (
          <div key={c.label} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: c.color, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>{c.label}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: totals.outstanding > 0 ? "#fff7ed" : "#F0F9FF", border: `1.5px solid ${totals.outstanding > 0 ? "#fed7aa" : "#BAE6FD"}`, borderRadius: 12, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
            {totals.outstanding > 0 ? "People still owing" : "Nothing outstanding"}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{allRows.length} {allRows.length === 1 ? "person has" : "people have"} been advanced money</div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: totals.outstanding > 0 ? "#b45309" : "#0369A1" }}>{totals.people}</div>
      </div>

      {allRows.some((r) => r.balance === 0) && (
        <button
          onClick={() => setOwingOnly((p) => !p)}
          style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: "#64748b", cursor: "pointer", marginBottom: 14 }}
        >
          {owingOnly ? "Showing people still owing" : "✓ Including people who have repaid in full"}
        </button>
      )}

      {rows.map((r) => (
        <div key={r.staffId || r.name} style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "12px 14px", marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{r.name}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                Advanced {fmt(r.advanced)} · repaid {fmt(r.repaid)}
              </div>
              {r.repayPerRun > 0 && (
                <div style={{ fontSize: 11, color: "#0369A1", marginTop: 2 }}>
                  🔁 {fmt(r.repayPerRun)}/pay run{r.runsLeft ? ` · ~${r.runsLeft} run${r.runsLeft === 1 ? "" : "s"} left` : ""}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: r.balance > 0 ? "#b45309" : "#0369A1" }}>{fmt(r.balance)}</div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>{r.balance > 0 ? "outstanding" : "settled"}</div>
            </div>
          </div>
          {/* The last few movements, so a balance can be checked without leaving
              the report for the Advances dashboard. */}
          {r.entries.slice(0, 4).map((e, i) => (
            <div key={`${r.staffId}-${e.date}-${i}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", borderTop: "1px solid #f1f5f9", paddingTop: 5, marginTop: 5 }}>
              <span>
                {e.date} · {e.type === "advance" ? "Advance given" : "Repaid from wages"}
                {e.note ? ` · ${e.note}` : ""}
              </span>
              <span style={{ fontWeight: 700, color: e.type === "advance" ? "#b45309" : "#0C4A6E", whiteSpace: "nowrap", marginLeft: 8 }}>
                {e.type === "advance" ? "+" : "−"}
                {fmt(e.amount)}
              </span>
            </div>
          ))}
          {r.entries.length > 4 && (
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>+ {r.entries.length - 4} more — all of them are in the PDF</div>
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
      <ExportCsvButton
        style={{ marginTop: 10 }}
        csv={() => ({
          filename: "advances-report",
          headers: ["Name", "Advanced", "Repaid", "Balance", "Repay per run", "Runs left"],
          rows: rows.map((r) => [r.name, r.advanced, r.repaid, r.balance, r.repayPerRun, r.runsLeft]),
        })}
      />
    </>
  );
}
