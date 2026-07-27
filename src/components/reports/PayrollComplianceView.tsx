"use client";

import Link from "next/link";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { usePayRuns } from "@/lib/supabase/hooks/usePayRuns";
import { useTaxRates } from "@/lib/taxRates";
import { calcETI, monthsEmployedFrom } from "@/lib/eti";
import { fmt } from "@/lib/format";

// One home for the payroll-specific statutory items — the numbers and reminders
// that otherwise live scattered across EMP201, the compliance dashboard and the
// termination flow. Read-only: reminders + figures to confirm with an accountant;
// filing still happens on the SARS/Labour portals.
export function PayrollComplianceView() {
  const { data: business } = useBusinessProfile();
  const { data: staff } = useStaffRegister();
  const { data: payRuns } = usePayRuns();
  const { SDL_ANNUAL_THRESHOLD } = useTaxRates();

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = now.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  const year = String(now.getFullYear());

  const runs = payRuns ?? [];
  const staffList = staff ?? [];
  const monthRuns = runs.filter((p) => p.pay_date.startsWith(monthKey));

  const paye = monthRuns.reduce((s, p) => s + Number(p.paye ?? 0), 0);
  const uif = monthRuns.reduce((s, p) => s + Number(p.uif_employee ?? 0) + Number(p.uif_employer ?? 0), 0);
  const sdl = monthRuns.reduce((s, p) => s + Number(p.sdl ?? 0), 0);
  const monthWages = monthRuns.reduce((s, p) => s + Number(p.gross_wages ?? 0), 0);

  // ETI claimable this month, capped at the PAYE it can offset.
  const etiRaw = monthRuns.reduce((s, p) => {
    const worker = staffList.find((w) => w.id === p.staff_id);
    if (!worker) return s;
    const e = calcETI(worker, Number(p.gross_wages ?? 0), monthsEmployedFrom(worker.start_date));
    return s + (e.eligible ? e.amount : 0);
  }, 0);
  const eti = Math.min(etiRaw, paye);
  const payableToSars = Math.max(0, paye - eti) + uif + sdl;

  const coidaEarnings = runs.filter((p) => p.pay_date.startsWith(year)).reduce((s, p) => s + Number(p.gross_wages ?? 0), 0);
  const annualisedWages = monthWages * 12;
  const sdlNudge = !business?.sdl_registered && annualisedWages > SDL_ANNUAL_THRESHOLD;

  const hasPayroll = staffList.length > 0 || runs.length > 0;

  const card: React.CSSProperties = { background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", marginBottom: 12 };
  const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <Link href="/tax" style={{ fontSize: 12, color: "#64748b" }}>
        ← Tax &amp; Compliance
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 4px" }}>Payroll Compliance</h1>
      <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 18, lineHeight: 1.5 }}>
        Your payroll statutory items in one place. Figures are estimates to confirm with your accountant — filing happens on the SARS &amp; Labour portals.
      </p>

      {!hasPayroll ? (
        <div style={{ ...card, textAlign: "center", color: "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💼</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>No payroll yet</div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            Add employees in the <Link href="/staff" style={{ color: "#0369A1", fontWeight: 600 }}>Staff Register</Link> and run a{" "}
            <Link href="/payroll" style={{ color: "#0369A1", fontWeight: 600 }}>Pay Run</Link> — this page then tracks what you owe SARS and Labour.
          </div>
        </div>
      ) : (
        <>
          {/* Payable to SARS this month */}
          <div style={{ background: "#0C4A6E", borderRadius: 16, padding: "18px 20px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Payable to SARS · {monthLabel}</div>
            <div style={{ ...rowStyle }}>
              <span style={{ fontSize: 13, color: "#7DD3FC" }}>PAYE</span>
              <span style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>{fmt(paye)}</span>
            </div>
            {eti > 0 && (
              <div style={{ ...rowStyle }}>
                <span style={{ fontSize: 13, color: "#7DD3FC" }}>Less: ETI claimed</span>
                <span style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>−{fmt(eti)}</span>
              </div>
            )}
            <div style={{ ...rowStyle }}>
              <span style={{ fontSize: 13, color: "#7DD3FC" }}>UIF (employee + employer)</span>
              <span style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>{fmt(uif)}</span>
            </div>
            {sdl > 0 && (
              <div style={{ ...rowStyle }}>
                <span style={{ fontSize: 13, color: "#7DD3FC" }}>SDL</span>
                <span style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>{fmt(sdl)}</span>
              </div>
            )}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, color: "#38BDF8", fontWeight: 700 }}>Total payable</span>
              <span style={{ fontSize: 22, color: "#fff", fontWeight: 900 }}>{fmt(payableToSars)}</span>
            </div>
            <Link href="/emp201" style={{ display: "block", textAlign: "center", marginTop: 12, background: "#38BDF8", color: "#0C4A6E", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              Open EMP201 →
            </Link>
          </div>

          {sdlNudge && (
            <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
              ⚠️ <strong>SDL may now apply.</strong> Your payroll annualises above {fmt(SDL_ANNUAL_THRESHOLD)} but SDL isn&apos;t registered. Check with your accountant, then switch SDL on in{" "}
              <Link href="/business" style={{ color: "#92400e", fontWeight: 700 }}>
                Business Details
              </Link>
              .
            </div>
          )}

          {/* Returns & declarations */}
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Returns &amp; declarations</div>

            <div style={{ ...rowStyle, borderBottom: "1px solid #f1f5f9" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>EMP201 — monthly</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>PAYE, UIF &amp; SDL · due by the 7th of next month</div>
              </div>
              <Link href="/emp201" style={{ fontSize: 12, color: "#0369A1", fontWeight: 600 }}>Open</Link>
            </div>

            <div style={{ ...rowStyle, borderBottom: "1px solid #f1f5f9" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>EMP501 — reconciliation</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Reconciles the EMP201s &amp; issues IRP5s · interim 31 Oct, annual 31 May (e@syFile)</div>
              </div>
            </div>

            <div style={{ ...rowStyle, borderBottom: "1px solid #f1f5f9" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>UIF declaration — monthly</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>uFiling · plus a UI-19 whenever someone joins or leaves</div>
              </div>
            </div>

            <div style={{ ...rowStyle }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>COIDA — Return of Earnings</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Annual (CompEasy) · earnings to report for {year}</div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#0C4A6E" }}>{fmt(coidaEarnings)}</span>
            </div>
          </div>

          <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
            Worklog surfaces these reminders and figures — it doesn&apos;t file for you. Confirm amounts and deadlines with your accountant.
          </p>
        </>
      )}
    </div>
  );
}
