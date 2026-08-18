"use client";

import { useState } from "react";
import Link from "next/link";
import { usePayRuns } from "@/lib/supabase/hooks/usePayRuns";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTaxFilings } from "@/lib/supabase/hooks/useTaxFilings";
import { fmt } from "@/lib/format";
import { shareReport } from "@/lib/docgen/shareReport";
import { buildCoidaHTML, type CoidaPdfData } from "@/lib/docgen/buildLedgerHTML";
import { FilingActions, FilingHistory } from "@/components/reports/FilingActions";
import { asAtLabel } from "@/components/reports/ReportShell";

// COIDA — the annual Return of Earnings filed on CompEasy. Earnings are the total
// gross wages paid in the year, per employee. The official ROE caps each
// employee's earnings at the annual OID threshold (which changes yearly and the
// app doesn't hold); this shows uncapped totals and says so, so nobody
// over-declares. A year stepper rather than a month one — this return is annual.
export function CoidaView() {
  const { data: business } = useBusinessProfile();
  const { data: staff } = useStaffRegister();
  const { data: payRuns } = usePayRuns();
  const { data: filings } = useTaxFilings();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const label = String(year);

  const yearRuns = (payRuns ?? []).filter((p) => p.pay_date.startsWith(`${year}-`));

  // Earnings per person, keyed on staff where possible so two workers who happen
  // to share a name don't collapse into one line.
  const byWorker = new Map<string, { name: string; earnings: number }>();
  for (const p of yearRuns) {
    const key = p.staff_id ?? `name:${p.worker_name}`;
    const prev = byWorker.get(key);
    byWorker.set(key, { name: p.worker_name, earnings: (prev?.earnings ?? 0) + Number(p.gross_wages ?? 0) });
  }
  const rows = [...byWorker.values()].sort((a, b) => b.earnings - a.earnings);
  const totalEarnings = rows.reduce((s, r) => s + r.earnings, 0);
  const employees = rows.length;

  const handleShare = () => {
    const lines = [
      `Total earnings to report: ${fmt(totalEarnings)}`,
      `Across ${employees} employee${employees !== 1 ? "s" : ""}`,
      ``,
      ...rows.map((r) => `${r.name}: ${fmt(r.earnings)}`),
    ];
    void shareReport("COIDA Return of Earnings", `${label} · uncapped`, lines, business);
  };

  const coidaPdfData = (): CoidaPdfData => ({
    yearLabel: label,
    employees,
    totalEarnings,
    rows: rows.map((r) => ({ workerName: r.name, earnings: r.earnings })),
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
          <span style={{ fontSize: 15, color: "#38BDF8", fontWeight: 700 }}>Total earnings</span>
          <span style={{ fontSize: 24, color: "#fff", fontWeight: 900 }}>{fmt(totalEarnings)}</span>
        </div>
        <div style={{ fontSize: 11, color: "#38BDF8", marginTop: 8 }}>
          {employees} employee{employees !== 1 ? "s" : ""} · total gross wages paid in {label}
        </div>
      </div>

      <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
        ⚠️ The ROE caps each employee&apos;s earnings at the annual OID threshold (it changes each year). This shows <strong>uncapped</strong> gross wages — confirm the cap with your accountant before submitting.
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
          {rows.map((r, i) => (
            <div key={`${r.name}-${i}`} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{r.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0C4A6E" }}>{fmt(r.earnings)}</span>
            </div>
          ))}
        </>
      )}

      <FilingHistory filingType="coida" filings={filings ?? []} />
    </div>
  );
}
