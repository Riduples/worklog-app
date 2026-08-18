"use client";

import { useState } from "react";
import Link from "next/link";
import { usePayRuns } from "@/lib/supabase/hooks/usePayRuns";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTaxFilings } from "@/lib/supabase/hooks/useTaxFilings";
import { useTaxRates } from "@/lib/taxRates";
import { fmt } from "@/lib/format";
import { shareReport } from "@/lib/docgen/shareReport";
import { buildCoidaHTML, type CoidaPdfData } from "@/lib/docgen/buildLedgerHTML";
import { FilingActions, FilingHistory } from "@/components/reports/FilingActions";
import { asAtLabel } from "@/components/reports/ReportShell";

// COIDA — the annual Return of Earnings filed on CompEasy. Earnings are the gross
// wages paid in the year, per employee, each CAPPED at the annual OID maximum
// (OID_EARNINGS_THRESHOLD — a Department of Employment & Labour figure gazetted
// yearly, admin-editable on the tax_rates table). The screen and PDF show the cap
// they applied, so a stale figure is visible rather than silent. A year stepper
// rather than a month one — this return is annual.
export function CoidaView() {
  const { data: business } = useBusinessProfile();
  const { data: staff } = useStaffRegister();
  const { data: payRuns } = usePayRuns();
  const { data: filings } = useTaxFilings();
  const { OID_EARNINGS_THRESHOLD: cap } = useTaxRates();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const label = String(year);

  const yearRuns = (payRuns ?? []).filter((p) => p.pay_date.startsWith(`${year}-`));

  // Earnings per person, keyed on staff where possible so two workers who happen
  // to share a name don't collapse into one line.
  const byWorker = new Map<string, { name: string; raw: number }>();
  for (const p of yearRuns) {
    const key = p.staff_id ?? `name:${p.worker_name}`;
    const prev = byWorker.get(key);
    byWorker.set(key, { name: p.worker_name, raw: (prev?.raw ?? 0) + Number(p.gross_wages ?? 0) });
  }
  // Each employee's declarable earnings are capped at the OID maximum before they
  // are summed — that's how the ROE is assessed.
  const rows = [...byWorker.values()]
    .map((w) => ({ name: w.name, raw: w.raw, earnings: Math.min(w.raw, cap) }))
    .sort((a, b) => b.earnings - a.earnings);
  const totalEarnings = rows.reduce((s, r) => s + r.earnings, 0);
  const totalRaw = rows.reduce((s, r) => s + r.raw, 0);
  const cappedCount = rows.filter((r) => r.raw > r.earnings + 0.005).length;
  const employees = rows.length;

  const handleShare = () => {
    const lines = [
      `Total earnings to report (capped): ${fmt(totalEarnings)}`,
      `Across ${employees} employee${employees !== 1 ? "s" : ""}`,
      `Capped at ${fmt(cap)} per employee${cappedCount > 0 ? ` · ${cappedCount} over the cap` : ""}`,
      ``,
      ...rows.map((r) => `${r.name}: ${fmt(r.earnings)}${r.raw > r.earnings + 0.005 ? ` (capped from ${fmt(r.raw)})` : ""}`),
    ];
    void shareReport("COIDA Return of Earnings", `${label} · capped at ${fmt(cap)}`, lines, business);
  };

  const coidaPdfData = (): CoidaPdfData => ({
    yearLabel: label,
    employees,
    totalEarnings,
    cap,
    cappedCount,
    rows: rows.map((r) => ({ workerName: r.name, earnings: r.earnings, raw: r.raw })),
  });

  if ((staff ?? []).length === 0 && yearRuns.length === 0) {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <Link href="/payroll-compliance" style={{ fontSize: 12, color: "#64748b" }}>
          ← Payroll Compliance
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>COIDA — Return of Earnings</h1>
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, textAlign: "center", fontSize: 13, color: "#64748b" }}>
          👷 No payroll yet. Run a{" "}
          <Link href="/payroll" style={{ color: "#0C4A6E", fontWeight: 700 }}>
            Pay Run
          </Link>{" "}
          — your Return of Earnings adds up the wages paid across the year.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <Link href="/payroll-compliance" style={{ fontSize: 12, color: "#64748b" }}>
        ← Payroll Compliance
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>COIDA — Return of Earnings</h1>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={() => setYear((y) => y - 1)} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 16, cursor: "pointer" }}>
          ‹
        </button>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{label}</div>
        <button onClick={() => setYear((y) => y + 1)} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 16, cursor: "pointer" }}>
          ›
        </button>
      </div>

      <div style={{ background: "#0C4A6E", borderRadius: 16, padding: "18px 20px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          Earnings to report · {label}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, color: "#38BDF8", fontWeight: 700 }}>Earnings to report</span>
          <span style={{ fontSize: 24, color: "#fff", fontWeight: 900 }}>{fmt(totalEarnings)}</span>
        </div>
        <div style={{ fontSize: 11, color: "#38BDF8", marginTop: 8 }}>
          {employees} employee{employees !== 1 ? "s" : ""} · capped at {fmt(cap)} each
          {cappedCount > 0 ? ` · ${cappedCount} over the cap` : ""}
        </div>
      </div>

      <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
        ⚠️ Each employee&apos;s earnings are capped at the OID maximum of <strong>{fmt(cap)}</strong> for the year (a Labour figure that changes yearly).
        {cappedCount > 0
          ? ` ${cappedCount} employee${cappedCount !== 1 ? "s were" : " was"} over it — gross wages this year were ${fmt(totalRaw)}.`
          : " No one is over it this year."}{" "}
        Confirm the current-year limit with your accountant.
      </div>

      <FilingActions
        filingType="coida"
        periodLabel={label}
        amount={totalEarnings}
        markLabel="Mark Return of Earnings as filed"
        hasData={yearRuns.length > 0}
        emptyLabel={`No wages recorded for ${label}.`}
        note="File the Return of Earnings on CompEasy — this is a calculation aid, not a filing. Due annually (historically end of March, extended in recent years)."
        filename={`coida-roe-${label}`}
        pdf={() => ({ kind: "coida", data: coidaPdfData(), asAt: asAtLabel() })}
        fallbackHtml={(b, w) => buildCoidaHTML(b, coidaPdfData(), asAtLabel(), w)}
        share={handleShare}
      />

      {rows.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Earnings by employee</div>
          {rows.map((r, i) => {
            const capped = r.raw > r.earnings + 0.005;
            return (
              <div key={`${r.name}-${i}`} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{r.name}</span>
                  {capped && <div style={{ fontSize: 11, color: "#b45309" }}>capped from {fmt(r.raw)}</div>}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0C4A6E" }}>{fmt(r.earnings)}</span>
              </div>
            );
          })}
        </>
      )}

      <FilingHistory filingType="coida" filings={filings ?? []} />
    </div>
  );
}
