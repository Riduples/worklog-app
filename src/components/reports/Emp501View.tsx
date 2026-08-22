"use client";

import { useState } from "react";
import Link from "next/link";
import { usePayRuns } from "@/lib/supabase/hooks/usePayRuns";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTaxFilings } from "@/lib/supabase/hooks/useTaxFilings";
import { calcETI, monthsEmployedFrom } from "@/lib/eti";
import { fmt } from "@/lib/format";
import { shareReport } from "@/lib/docgen/shareReport";
import { buildEmp501HTML, type Emp501PdfData } from "@/lib/docgen/buildLedgerHTML";
import { FilingActions, FilingHistory } from "@/components/reports/FilingActions";
import { asAtLabel } from "@/components/reports/ReportShell";
import type { Tables } from "@/lib/types/database";

type PayRun = Tables<"pay_runs">;
type StaffRow = Tables<"staff_register">;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The SA tax year runs 1 March–end February. The EMP501 reconciles it in two
// windows: the interim (Mar–Aug) and the annual (the whole Mar–Feb year).
type Recon = "interim" | "annual";

// The (year, month0) pairs that make up a reconciliation window, starting at
// March of the tax year.
function periodMonths(startYear: number, recon: Recon): { year: number; month0: number }[] {
  const count = recon === "interim" ? 6 : 12;
  const out: { year: number; month0: number }[] = [];
  for (let i = 0; i < count; i++) {
    const m = 2 + i; // March = index 2
    out.push({ year: startYear + Math.floor(m / 12), month0: m % 12 });
  }
  return out;
}

// One month's EMP201 figures from the pay runs — the same shape EMP201 shows,
// so "per pay runs" here matches what that screen would have declared.
function monthFigures(runs: PayRun[], staff: StaffRow[]) {
  const paye = runs.reduce((s, p) => s + Number(p.paye ?? 0), 0);
  const uif = runs.reduce((s, p) => s + Number(p.uif_employee ?? 0) + Number(p.uif_employer ?? 0), 0);
  const sdl = runs.reduce((s, p) => s + Number(p.sdl ?? 0), 0);

  // ETI is monthly and per-employee: aggregate each person's runs into one
  // monthly gross before calling calcETI, then cap the total at PAYE.
  const grossByStaff = new Map<string, number>();
  for (const p of runs) {
    if (!p.staff_id) continue;
    grossByStaff.set(p.staff_id, (grossByStaff.get(p.staff_id) ?? 0) + Number(p.gross_wages ?? 0));
  }
  const etiRaw = [...grossByStaff.entries()].reduce((s, [staffId, gross]) => {
    const row = staff.find((sm) => sm.id === staffId);
    if (!row) return s;
    const e = calcETI(row, gross, monthsEmployedFrom(row.start_date));
    return s + (e.eligible ? e.amount : 0);
  }, 0);
  const eti = Math.min(etiRaw, paye);

  return { paye, uif, sdl, eti, totalDue: paye + uif + sdl - eti };
}

// `embedded` = rendered as a tab inside the Payroll Compliance hub — drops its
// own back-link, title and outer padding (the hub supplies them).
export function Emp501View({ embedded = false }: { embedded?: boolean } = {}) {
  const { data: business } = useBusinessProfile();
  const { data: staff } = useStaffRegister();
  const { data: payRuns } = usePayRuns();
  const { data: filings } = useTaxFilings();

  const today = new Date();
  // Default to the tax year we're currently in (March starts a new one).
  const defaultStartYear = today.getMonth() >= 2 ? today.getFullYear() : today.getFullYear() - 1;
  const [startYear, setStartYear] = useState(defaultStartYear);
  const [recon, setRecon] = useState<Recon>("annual");

  const staffList = staff ?? [];
  const runs = payRuns ?? [];
  const emp201Filings = (filings ?? []).filter((f) => f.filing_type === "emp201");

  const taxYearLabel = `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
  const periodLabel = `${taxYearLabel} ${recon === "interim" ? "interim (Mar–Aug)" : "annual (Mar–Feb)"}`;

  const months = periodMonths(startYear, recon);
  const rows = months.map(({ year, month0 }) => {
    const key = `${year}-${String(month0 + 1).padStart(2, "0")}`;
    const monthRuns = runs.filter((p) => p.pay_date.startsWith(key));
    const fig = monthFigures(monthRuns, staffList);
    const monthLabel = `${MONTH_NAMES[month0]} ${year}`;
    const filing = emp201Filings.find((f) => f.period_label === monthLabel);
    return {
      monthLabel,
      hasRuns: monthRuns.length > 0,
      calculated: fig.totalDue,
      declared: filing ? Number(filing.amount) : null,
      ...fig,
    };
  });

  const activeRows = rows.filter((r) => r.hasRuns || r.declared != null);
  const paye = rows.reduce((s, r) => s + r.paye, 0);
  const uif = rows.reduce((s, r) => s + r.uif, 0);
  const sdl = rows.reduce((s, r) => s + r.sdl, 0);
  const eti = rows.reduce((s, r) => s + r.eti, 0);
  const totalCalculated = rows.reduce((s, r) => s + r.calculated, 0);
  const totalDeclared = rows.reduce((s, r) => s + (r.declared ?? 0), 0);
  const difference = totalCalculated - totalDeclared;
  const reconciled = Math.abs(difference) < 0.5;
  const monthsFiled = rows.filter((r) => r.declared != null).length;
  const monthsWithRuns = rows.filter((r) => r.hasRuns).length;
  const hasData = activeRows.length > 0;

  const handleShare = () => {
    const lines = [
      `Per pay runs: ${fmt(totalCalculated)}`,
      `Declared on EMP201s filed: ${fmt(totalDeclared)}`,
      `${reconciled ? "Reconciled" : "Difference to resolve"}: ${fmt(difference)}`,
      ``,
      `${monthsFiled} of ${monthsWithRuns} months with pay runs marked filed`,
    ];
    void shareReport("EMP501 reconciliation", periodLabel, lines, business);
  };

  const emp501PdfData = (): Emp501PdfData => ({
    periodLabel,
    paye,
    uif,
    sdl,
    eti,
    totalCalculated,
    totalDeclared,
    difference,
    rows: activeRows.map((r) => ({ month: r.monthLabel, declared: r.declared, calculated: r.calculated })),
  });

  return (
    <div style={{ padding: embedded ? 0 : "20px 16px 100px" }}>
      {!embedded && (
        <Link href="/payroll-compliance" style={{ fontSize: 12, color: "#64748b" }}>
          ← Payroll Compliance
        </Link>
      )}
      {!embedded && <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 6px" }}>EMP501 reconciliation</h1>}
      {/* No blurb here. The EMP501 row on the Payroll Compliance overview — the
          only way onto this screen, since /emp501 redirects to it — already says
          it reconciles your EMP201s on e@syFile, and the filing box below states
          in full that this is a calculation aid that issues no IRP5/IT3(a)
          certificates. Saying it a third time on arrival just pushed the
          reconciliation down. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => setStartYear((y) => y - 1)} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 16, cursor: "pointer" }}>
          ‹
        </button>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>Tax year {taxYearLabel}</div>
        <button onClick={() => setStartYear((y) => y + 1)} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 16, cursor: "pointer" }}>
          ›
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3, marginBottom: 14 }}>
        {(["interim", "annual"] as Recon[]).map((r) => (
          <button
            key={r}
            onClick={() => setRecon(r)}
            style={{ flex: 1, padding: "7px 6px", borderRadius: 8, border: "none", background: recon === r ? "#fff" : "transparent", color: recon === r ? "#0C4A6E" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: recon === r ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
          >
            {r === "interim" ? "Interim (Mar–Aug)" : "Annual (Mar–Feb)"}
          </button>
        ))}
      </div>

      <div style={{ background: "#0C4A6E", borderRadius: 16, padding: "18px 20px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          {periodLabel}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: "#7DD3FC" }}>Per pay runs</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{fmt(totalCalculated)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: "#7DD3FC" }}>Declared on EMP201s filed</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{fmt(totalDeclared)}</span>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, color: reconciled ? "#38BDF8" : "#FCD34D", fontWeight: 700 }}>{reconciled ? "✅ Reconciled" : "Difference to resolve"}</span>
          <span style={{ fontSize: 24, color: "#fff", fontWeight: 900 }}>{fmt(difference)}</span>
        </div>
        <div style={{ fontSize: 11, color: "#38BDF8", marginTop: 8 }}>
          {monthsFiled} of {monthsWithRuns} month{monthsWithRuns !== 1 ? "s" : ""} with pay runs marked filed
        </div>
      </div>

      <FilingActions
        filingType="emp501"
        periodLabel={periodLabel}
        amount={totalCalculated}
        markLabel="Mark EMP501 as filed"
        hasData={hasData}
        emptyLabel={`No pay runs or EMP201s in ${periodLabel}.`}
        note="Reconcile these totals with your IRP5/IT3(a) certificates and file on SARS e@syFile — interim due 31 Oct, annual due 31 May. This is a calculation aid, not a filing, and it does not generate certificates."
        filename={`emp501-${taxYearLabel.replace("/", "-")}-${recon}`}
        pdf={() => ({ kind: "emp501", data: emp501PdfData(), asAt: asAtLabel() })}
        fallbackHtml={(b, w) => buildEmp501HTML(b, emp501PdfData(), asAtLabel(), w)}
        share={handleShare}
      />

      {activeRows.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Month by month</div>
          {activeRows.map((r) => {
            const diff = r.declared == null ? null : r.calculated - r.declared;
            const off = diff != null && Math.abs(diff) >= 0.5;
            return (
              <div key={r.monthLabel} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{r.monthLabel}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0C4A6E" }}>{fmt(r.calculated)}</span>
                </div>
                <div style={{ fontSize: 11, color: off ? "#be123c" : "#94a3b8" }}>
                  {r.declared == null ? "EMP201 not marked filed" : `Declared ${fmt(r.declared)}${off ? ` · off by ${fmt(diff!)}` : " · matches"}`}
                </div>
              </div>
            );
          })}
        </>
      )}

      <FilingHistory filingType="emp501" filings={filings ?? []} />
    </div>
  );
}
