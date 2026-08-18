"use client";

import { useState } from "react";
import Link from "next/link";
import { usePayRuns } from "@/lib/supabase/hooks/usePayRuns";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTaxFilings } from "@/lib/supabase/hooks/useTaxFilings";
import { useTaxRates } from "@/lib/taxRates";
import { calcETI, monthsEmployedFrom } from "@/lib/eti";
import { fmt } from "@/lib/format";
import { shareReport } from "@/lib/docgen/shareReport";
import { buildEmp201HTML, type Emp201PdfData } from "@/lib/docgen/buildLedgerHTML";
import { FilingActions, FilingHistory } from "@/components/reports/FilingActions";
import { asAtLabel } from "@/components/reports/ReportShell";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function Emp201View() {
  const { data: business } = useBusinessProfile();
  const { data: staff } = useStaffRegister();
  const { data: payRuns } = usePayRuns();
  const { data: filings } = useTaxFilings();
  const { SDL_ANNUAL_THRESHOLD } = useTaxRates();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month0, setMonth0] = useState(today.getMonth());

  const step = (dir: 1 | -1) => {
    let m = month0 + dir;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setYear(y);
    setMonth0(m);
  };

  const monthKey = `${year}-${String(month0 + 1).padStart(2, "0")}`;
  const label = `${MONTH_NAMES[month0]} ${year}`;

  const monthRuns = (payRuns ?? []).filter((p) => p.pay_date.startsWith(monthKey));
  const paye = monthRuns.reduce((s, p) => s + Number(p.paye ?? 0), 0);
  const uifEmployee = monthRuns.reduce((s, p) => s + Number(p.uif_employee ?? 0), 0);
  const uifEmployer = monthRuns.reduce((s, p) => s + Number(p.uif_employer ?? 0), 0);
  const sdl = monthRuns.reduce((s, p) => s + Number(p.sdl ?? 0), 0);

  // ETI (Employment Tax Incentive) — reduces PAYE for qualifying 18–29 staff.
  // ETI is a MONTHLY, per-employee calculation: the amount is a function of the
  // employee's total remuneration for the month, so aggregate all of an
  // employee's runs (a weekly worker has ~4–5) into one monthly gross and call
  // calcETI ONCE — computing it per weekly run would hit the wrong ETI band and
  // multiply the claim. Then cap the total at PAYE (ETI can never make the PAYE
  // line negative — the excess is carried by the accountant).
  const grossByStaff = new Map<string, number>();
  for (const p of monthRuns) {
    if (!p.staff_id) continue; // no staff link → can't attribute ETI
    grossByStaff.set(p.staff_id, (grossByStaff.get(p.staff_id) ?? 0) + Number(p.gross_wages ?? 0));
  }
  const etiRaw = [...grossByStaff.entries()].reduce((s, [staffId, monthlyGross]) => {
    const staffRow = (staff ?? []).find((sm) => sm.id === staffId);
    if (!staffRow) return s;
    const e = calcETI(staffRow, monthlyGross, monthsEmployedFrom(staffRow.start_date));
    return s + (e.eligible ? e.amount : 0);
  }, 0);
  const eti = Math.min(etiRaw, paye);

  const totalDue = paye + uifEmployee + uifEmployer + sdl - eti;
  const employeesPaid = new Set(monthRuns.map((p) => p.staff_id)).size;

  // SDL threshold nudge — annualise this month's gross and flag if it crosses the
  // registration threshold while the business isn't yet SDL-registered.
  const monthGross = monthRuns.reduce((s, p) => s + Number(p.gross_wages ?? 0), 0);
  const annualisedWages = monthGross * 12;
  const sdlNudge = annualisedWages > SDL_ANNUAL_THRESHOLD && !business?.sdl_registered;

  // COIDA (annual Return of Earnings) — total gross wages paid this calendar year.
  const coidaEarnings = (payRuns ?? [])
    .filter((p) => p.pay_date.startsWith(`${year}-`))
    .reduce((s, p) => s + Number(p.gross_wages ?? 0), 0);

  // EMP201 is due by the 7th of the month after the pay month.
  const dueMonth0 = (month0 + 1) % 12;
  const dueYear = month0 === 11 ? year + 1 : year;
  const dueDate = `7 ${MONTH_NAMES[dueMonth0]} ${dueYear}`;

  const handleShare = () => {
    const lines = [
      `PAYE (employee tax): ${fmt(paye)}`,
      `UIF (employee + employer): ${fmt(uifEmployee + uifEmployer)}`,
    ];
    if (sdl > 0) lines.push(`SDL (1%): ${fmt(sdl)}`);
    if (eti > 0) lines.push(`Less: ETI claimed: −${fmt(eti)}`);
    lines.push(`Total due to SARS: ${fmt(totalDue)}`);
    void shareReport("EMP201", `${label} · ${employeesPaid} employee${employeesPaid !== 1 ? "s" : ""} paid`, lines, business);
  };

  // The structured body the render-pdf route rebuilds the EMP201 working from —
  // rebuilt at click time so it always reflects the month on screen.
  const emp201PdfData = (): Emp201PdfData => ({
    periodLabel: label,
    dueDate,
    employeesPaid,
    paye,
    uifEmployee,
    uifEmployer,
    sdl,
    eti,
    totalDue,
    payeRef: business?.paye_ref ?? "",
    runs: monthRuns.map((p) => ({
      workerName: p.worker_name,
      payDate: p.pay_date,
      gross: Number(p.gross_wages ?? 0),
      paye: Number(p.paye ?? 0),
      uif: Number(p.uif_employee ?? 0) + Number(p.uif_employer ?? 0),
    })),
  });

  if ((staff ?? []).length === 0) {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <Link href="/tax" style={{ fontSize: 12, color: "#64748b" }}>
          ← Compliance &amp; Financials
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>EMP201</h1>
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, textAlign: "center", fontSize: 13, color: "#64748b" }}>
          👷 No employees registered. Add them in{" "}
          <Link href="/staff" style={{ color: "#0C4A6E", fontWeight: 700 }}>
            Staff Register
          </Link>{" "}
          first — EMP201 is only required once you have staff on payroll.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <Link href="/tax" style={{ fontSize: 12, color: "#64748b" }}>
        ← Compliance &amp; Financials
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>EMP201</h1>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={() => step(-1)} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 16, cursor: "pointer" }}>
          ‹
        </button>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{label}</div>
        <button onClick={() => step(1)} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 16, cursor: "pointer" }}>
          ›
        </button>
      </div>

      <div style={{ background: "#0C4A6E", borderRadius: 16, padding: "18px 20px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          {label} · {employeesPaid} employee{employeesPaid !== 1 ? "s" : ""} paid
        </div>
        {[
          ["PAYE (employee tax)", paye],
          ["UIF — employee (1%)", uifEmployee],
          ["UIF — employer (1%)", uifEmployer],
          ...(sdl > 0 ? ([["SDL (1%)", sdl]] as [string, number][]) : []),
        ].map(([l, v]) => (
          <div key={l as string} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "#7DD3FC" }}>{l}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{fmt(v as number)}</span>
          </div>
        ))}
        {eti > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "#7DD3FC" }}>Less: ETI claimed</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>−{fmt(eti)}</span>
          </div>
        )}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, color: "#38BDF8", fontWeight: 700 }}>Total due to SARS</span>
          <span style={{ fontSize: 24, color: "#fff", fontWeight: 900 }}>{fmt(totalDue)}</span>
        </div>
        <div style={{ fontSize: 11, color: "#38BDF8", marginTop: 8 }}>Due {dueDate}</div>
      </div>

      {!business?.paye_ref && (
        <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400e" }}>
          ⚠️ No PAYE reference number set. Add it in{" "}
          <Link href="/business" style={{ color: "#92400e", fontWeight: 700 }}>
            Business Details
          </Link>{" "}
          — SARS requires it on every EMP201 submission.
        </div>
      )}

      {sdlNudge && (
        <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400e" }}>
          ⚠️ SDL may now apply — your payroll annualises above {fmt(SDL_ANNUAL_THRESHOLD)}. Check with your accountant, then switch SDL on in{" "}
          <Link href="/business" style={{ color: "#92400e", fontWeight: 700 }}>
            Business Details
          </Link>
          .
        </div>
      )}

      <FilingActions
        filingType="emp201"
        periodLabel={label}
        amount={totalDue}
        markLabel="Mark EMP201 as filed"
        hasData={monthRuns.length > 0}
        emptyLabel={`No pay runs recorded for ${label}.`}
        note="Submit the actual EMP201 via SARS eFiling and declare UIF separately on uFiling — this is a calculation aid, not a filing. Penalty: 10% of PAYE if late."
        filename={`emp201-${monthKey}`}
        pdf={() => ({ kind: "emp201", data: emp201PdfData(), asAt: asAtLabel() })}
        fallbackHtml={(b, w) => buildEmp201HTML(b, emp201PdfData(), asAtLabel(), w)}
        share={handleShare}
      />

      {monthRuns.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Pay runs in {label}</div>
          {monthRuns.map((p) => (
            <div key={p.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{p.worker_name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0C4A6E" }}>{fmt(p.gross_wages)}</span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {p.pay_date} · PAYE {fmt(p.paye ?? 0)} · UIF {fmt(Number(p.uif_employee ?? 0) + Number(p.uif_employer ?? 0))}
              </div>
            </div>
          ))}
        </>
      )}

      <FilingHistory filingType="emp201" filings={filings ?? []} />

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Related returns</div>
        <Link href="/uif-declaration" style={{ display: "block", textDecoration: "none", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>UIF declaration (monthly)</span>
            <span style={{ fontSize: 12, color: "#0369A1", fontWeight: 600 }}>Open →</span>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>Declared to the Department of Employment &amp; Labour on uFiling — separately from this SARS return.</div>
        </Link>
        <Link href="/emp501" style={{ display: "block", textDecoration: "none", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>EMP501 reconciliation</span>
            <span style={{ fontSize: 12, color: "#0369A1", fontWeight: 600 }}>Open →</span>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
            Twice-yearly reconciliation of your EMP201s — interim due 31 Oct, annual due 31 May.
          </div>
        </Link>
        <Link href="/coida-roe" style={{ display: "block", textDecoration: "none", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>COIDA (annual Return of Earnings)</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0C4A6E" }}>{fmt(coidaEarnings)}</span>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>Earnings to report for {year} — total gross wages paid this calendar year.</div>
        </Link>
      </div>
    </div>
  );
}
