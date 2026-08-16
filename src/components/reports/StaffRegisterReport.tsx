"use client";

import { useState } from "react";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTrialState } from "@/lib/supabase/hooks/useSubscription";
import { aggregateStaffRegister, type StaffReportRow } from "@/lib/payrollReports";
import { shareReport } from "@/lib/docgen/shareReport";
import { buildStaffRegisterHTML } from "@/lib/docgen/buildLedgerHTML";
import { openDocumentForPrinting } from "@/lib/docgen/shareDocument";
import { renderPdf, downloadBlob } from "@/lib/docgen/renderPdf";
import { fmt, todayStr } from "@/lib/format";

// The order the register's own type filter uses, so the two screens read the same.
const TYPE_ORDER = ["Permanent", "Fixed-term", "Casual", "Contractor"];

const statusOf = (r: StaffReportRow) =>
  r.terminated ? `Left${r.termEndDate ? ` ${r.termEndDate}` : ""}${r.termReason ? ` · ${r.termReason}` : ""}` : "Active";

// The Staff tab of Payroll Reports — the whole register on one page: who works
// here, on what terms, and what payroll costs a month. The register itself is for
// keeping the records; this is for handing the answer to someone who asked.
export function StaffRegisterReport() {
  const { data: staff } = useStaffRegister();
  const { data: business } = useBusinessProfile();
  const { isTrialing, isReadOnly } = useTrialState();
  const watermark = isTrialing || isReadOnly;
  const [busy, setBusy] = useState(false);
  const [includeLeft, setIncludeLeft] = useState(true);

  const all = staff ?? [];
  // Filtering before the roll-up rather than after keeps every total honest —
  // hide the people who have left and the counts stop mentioning them too.
  const scoped = includeLeft ? all : all.filter((s) => s.terminated !== true);
  const { rows, totals } = aggregateStaffRegister(scoped);

  const groups = [
    ...TYPE_ORDER.filter((t) => rows.some((r) => r.employmentType === t)),
    ...[...new Set(rows.map((r) => r.employmentType))].filter((t) => !TYPE_ORDER.includes(t)),
  ].map((type) => ({
    type,
    people: rows
      .filter((r) => r.employmentType === type)
      .sort((a, b) => Number(a.terminated) - Number(b.terminated) || a.name.localeCompare(b.name)),
  }));

  const pdfRows = rows.map((r) => ({
    name: r.name,
    employeeNumber: r.employeeNumber,
    employmentType: r.employmentType,
    payType: r.payType,
    rate: r.rate,
    daysPerWeek: r.daysPerWeek,
    hoursPerDay: r.hoursPerDay,
    startDate: r.startDate,
    monthsEmployed: r.monthsEmployed,
    monthlyCost: r.monthlyCost,
    status: statusOf(r),
  }));

  const handlePrint = async () => {
    if (!business || busy) return;
    setBusy(true);
    const asAt = new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
    try {
      const blob = await renderPdf({ kind: "staffregisterreport", rows: pdfRows, totals, asAt });
      downloadBlob(blob, "staff-register");
    } catch {
      openDocumentForPrinting(buildStaffRegisterHTML(business, pdfRows, totals, asAt, watermark), "staff-register");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = () => {
    const lines = [
      `${totals.active} currently employed · ${totals.employees} employee${totals.employees === 1 ? "" : "s"} · ${totals.contractors} contractor${totals.contractors === 1 ? "" : "s"}`,
      `Est. monthly wage bill: ${fmt(totals.monthlyWageBill)}`,
      ``,
      ...groups.flatMap((g) => [
        `${g.type}:`,
        ...g.people.map((p) => `   ${p.name} — ${p.payType} ${fmt(p.rate)} · ${fmt(p.monthlyCost)}/mo${p.terminated ? " (left)" : ""}`),
      ]),
    ];
    if (rows.length === 0) lines.push("Nobody on the register yet.");
    void shareReport("Staff Register", `As at ${todayStr()}`, lines, business);
  };

  return (
    <>
      {all.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", margin: "40px 0" }}>Nobody on the staff register yet.</p>
      ) : (
        <>
          <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 2px 12px" }}>
            Everyone on the books, what they&apos;re paid and what that costs a month.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
            {[
              { label: "Employed", value: String(totals.active), color: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD" },
              { label: "Contractors", value: String(totals.contractors), color: "#92400e", bg: "#fff7ed", border: "#fed7aa" },
              { label: "Left", value: String(totals.left), color: "#0f172a", bg: "#f8fafc", border: "#e2e8f0" },
            ].map((c) => (
              <div key={c.label} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: c.color, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>{c.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Est. monthly wage bill</div>
              <div style={{ fontSize: 10, color: "#7DD3FC", marginTop: 2 }}>From each person&apos;s rate and allowance — a pay run&apos;s actual gross is what gets paid</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", whiteSpace: "nowrap", marginLeft: 10 }}>{fmt(totals.monthlyWageBill)}</div>
          </div>

          {/* Only worth offering once somebody has actually left. */}
          {all.some((s) => s.terminated) && (
            <button
              onClick={() => setIncludeLeft((p) => !p)}
              style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: "#64748b", cursor: "pointer", marginBottom: 14 }}
            >
              {includeLeft ? "✓ Including people who have left" : "Currently employed only"}
            </button>
          )}

          {groups.map((g) => (
            <div key={g.type} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0C4A6E", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                <span>{g.type}</span>
                <span>{g.people.length}</span>
              </div>
              {g.people.map((p) => (
                <div
                  key={p.id}
                  style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-start", opacity: p.terminated ? 0.6 : 1 }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>
                      {p.name}
                      {p.employeeNumber ? <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}> · {p.employeeNumber}</span> : null}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {p.payType} {fmt(p.rate)}
                      {p.daysPerWeek ? ` · ${p.daysPerWeek}d × ${p.hoursPerDay}h` : ""}
                      {p.startDate ? ` · from ${p.startDate} (${p.monthsEmployed}m)` : ""}
                    </div>
                    {p.terminated ? (
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>🚪 {statusOf(p)}</div>
                    ) : (
                      p.contractEndDate && <div style={{ fontSize: 11, color: "#6d28d9", marginTop: 2 }}>Contract ends {p.contractEndDate}</div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0C4A6E" }}>{fmt(p.monthlyCost)}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>per month</div>
                  </div>
                </div>
              ))}
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
      )}
    </>
  );
}
