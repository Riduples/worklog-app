"use client";

import { useState } from "react";
import Link from "next/link";
import { usePayRuns } from "@/lib/supabase/hooks/usePayRuns";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTaxFilings, useMarkFiled, useUnmarkFiled } from "@/lib/supabase/hooks/useTaxFilings";
import { useTrialState } from "@/lib/supabase/hooks/useSubscription";
import { useTaxRates } from "@/lib/taxRates";
import { calcETI, monthsEmployedFrom } from "@/lib/eti";
import { fmt } from "@/lib/format";
import { shareReport } from "@/lib/docgen/shareReport";
import { renderPdf, downloadBlob } from "@/lib/docgen/renderPdf";
import { openDocumentForPrinting } from "@/lib/docgen/shareDocument";
import { buildEmp201HTML, type Emp201PdfData } from "@/lib/docgen/buildLedgerHTML";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function Emp201View() {
  const { data: business } = useBusinessProfile();
  const { data: staff } = useStaffRegister();
  const { data: payRuns } = usePayRuns();
  const { data: filings } = useTaxFilings();
  const markFiled = useMarkFiled();
  const unmarkFiled = useUnmarkFiled();
  const { isTrialing, isReadOnly } = useTrialState();
  const watermark = isTrialing || isReadOnly;
  const { SDL_ANNUAL_THRESHOLD } = useTaxRates();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month0, setMonth0] = useState(today.getMonth());
  const [busy, setBusy] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [undoError, setUndoError] = useState("");

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

  const emp201Filings = (filings ?? []).filter((f) => f.filing_type === "emp201");
  const currentFiling = emp201Filings.find((f) => f.period_label === label);
  const alreadyFiled = !!currentFiling;

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

  const handlePrint = async () => {
    if (!business || busy) return;
    setBusy(true);
    const asAt = new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
    try {
      const blob = await renderPdf({ kind: "emp201", data: emp201PdfData(), asAt });
      downloadBlob(blob, `emp201-${monthKey}`);
    } catch {
      // Chromium cold/absent/timed out — fall back to the print flow.
      openDocumentForPrinting(buildEmp201HTML(business, emp201PdfData(), asAt, watermark), `emp201-${monthKey}`);
    } finally {
      setBusy(false);
    }
  };

  // Undo a mistaken "mark as filed" — deletes only the marker row. Nothing else
  // was created (this never touched eFiling), so there's nothing to reverse.
  const handleUnfile = () => {
    if (!currentFiling) return;
    setUndoError("");
    unmarkFiled.mutate(currentFiling.id, {
      onSuccess: () => setShowUndo(false),
      onError: (e) => setUndoError(e instanceof Error ? e.message : "Couldn't undo the filing."),
    });
  };

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

      {monthRuns.length === 0 ? (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 14, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
          No pay runs recorded for {label}.
        </div>
      ) : alreadyFiled ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#0369A1" }}>
            ✅ Marked as filed for {label}
            {currentFiling?.filed_date ? <span style={{ color: "#64748b" }}> · {currentFiling.filed_date}</span> : null}
          </div>
          {/* Made a mistake? Un-marking removes only this "filed" record — it never
              touched eFiling, so nothing else has to be reversed. Mirrors the
              payslip's "void this pay run", scaled to what an EMP201 marker is. */}
          <button
            onClick={() => setShowUndo((p) => !p)}
            style={{ width: "100%", marginTop: 8, background: "#fff1f2", border: "1.5px solid #fecdd3", borderRadius: 12, padding: "11px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#be123c" }}>↩️ Made a mistake? Undo this filing</span>
            <span style={{ color: "#be123c" }}>{showUndo ? "▲" : "▼"}</span>
          </button>
          {showUndo && (
            <div style={{ background: "#fff1f2", border: "1.5px solid #fecdd3", borderRadius: 12, padding: 14, marginTop: 8 }}>
              <div style={{ fontSize: 12, color: "#7f1d1d", lineHeight: 1.6, marginBottom: 10 }}>
                This removes the “filed” record for <strong>{label}</strong> so you can re-mark it once the numbers are right. It doesn&apos;t change anything on SARS eFiling — that submission, if you made one, stays as it is.
              </div>
              {undoError && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 10 }}>{undoError}</p>}
              <button
                onClick={handleUnfile}
                disabled={unmarkFiled.isPending}
                style={{ width: "100%", background: "#be123c", color: "#fff", border: "none", borderRadius: 12, padding: 13, fontSize: 13, fontWeight: 700, cursor: unmarkFiled.isPending ? "default" : "pointer", opacity: unmarkFiled.isPending ? 0.6 : 1 }}
              >
                {unmarkFiled.isPending ? "Undoing..." : "Confirm — undo this filing"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => markFiled.mutate({ filing_type: "emp201", period_label: label, amount: totalDue })}
          disabled={markFiled.isPending}
          style={{ width: "100%", background: "#0369A1", border: "none", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, color: "#fff", cursor: markFiled.isPending ? "default" : "pointer", marginBottom: 14 }}
        >
          {markFiled.isPending ? "Saving..." : "✔️ Mark EMP201 as filed"}
        </button>
      )}

      <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#92400e", lineHeight: 1.6, marginBottom: 14 }}>
        Submit the actual EMP201 via SARS eFiling and declare UIF separately on uFiling — this is a calculation aid, not a filing. Penalty: 10% of PAYE if late.
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
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

      {emp201Filings.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Filing history</div>
          {emp201Filings.map((f) => (
            <div key={f.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{f.period_label}</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {fmt(f.amount)} · filed {f.filed_date}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Related returns</div>
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#111", marginBottom: 2 }}>EMP501 reconciliation</div>
          <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
            Twice-yearly reconciliation of your EMP201s — interim due 31 Oct, annual due 31 May. Reconcile these EMP201 totals with your IRP5/IT3(a) certificates on SARS eFiling.
          </div>
        </div>
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>COIDA (annual Return of Earnings)</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0C4A6E" }}>{fmt(coidaEarnings)}</span>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>Earnings to report for {year} — total gross wages paid this calendar year.</div>
        </div>
      </div>
    </div>
  );
}
