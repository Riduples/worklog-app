"use client";

import { useState } from "react";
import Link from "next/link";
import { usePayRuns } from "@/lib/supabase/hooks/usePayRuns";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTaxFilings } from "@/lib/supabase/hooks/useTaxFilings";
import { fmt } from "@/lib/format";
import { shareReport } from "@/lib/docgen/shareReport";
import { buildUif201HTML, type Uif201PdfData } from "@/lib/docgen/buildLedgerHTML";
import { FilingActions, FilingHistory } from "@/components/reports/FilingActions";
import { asAtLabel } from "@/components/reports/ReportShell";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The monthly UIF declaration — the 1% off each worker plus the 1% the employer
// matches, declared to the Department of Employment & Labour on uFiling. The
// numbers are the same ones EMP201 shows for UIF; this is the standalone view for
// the separate declaration, with its own mark-as-filed history.
// `embedded` = rendered as a tab inside the Payroll Compliance hub — drops its
// own back-link, title and outer padding (the hub supplies them).
export function Uif201View({ embedded = false }: { embedded?: boolean } = {}) {
  const { data: business } = useBusinessProfile();
  const { data: staff } = useStaffRegister();
  const { data: payRuns } = usePayRuns();
  const { data: filings } = useTaxFilings();

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
  const uifEmployee = monthRuns.reduce((s, p) => s + Number(p.uif_employee ?? 0), 0);
  const uifEmployer = monthRuns.reduce((s, p) => s + Number(p.uif_employer ?? 0), 0);
  const total = uifEmployee + uifEmployer;
  const employeesPaid = new Set(monthRuns.map((p) => p.staff_id)).size;

  // The UIF declaration is due by the 7th of the month after the pay month, the
  // same deadline the EMP201 rides on.
  const dueMonth0 = (month0 + 1) % 12;
  const dueYear = month0 === 11 ? year + 1 : year;
  const dueDate = `7 ${MONTH_NAMES[dueMonth0]} ${dueYear}`;

  const handleShare = () => {
    const lines = [
      `UIF — employee (1%): ${fmt(uifEmployee)}`,
      `UIF — employer (1%): ${fmt(uifEmployer)}`,
      `Total UIF: ${fmt(total)}`,
    ];
    void shareReport("UIF declaration", `${label} · ${employeesPaid} employee${employeesPaid !== 1 ? "s" : ""}`, lines, business);
  };

  const uif201PdfData = (): Uif201PdfData => ({
    periodLabel: label,
    dueDate,
    employeesPaid,
    uifEmployee,
    uifEmployer,
    total,
    uifRef: business?.paye_ref ?? "",
    rows: monthRuns.map((p) => ({
      workerName: p.worker_name,
      payDate: p.pay_date,
      gross: Number(p.gross_wages ?? 0),
      uifEmployee: Number(p.uif_employee ?? 0),
      uifEmployer: Number(p.uif_employer ?? 0),
    })),
  });

  if ((staff ?? []).length === 0) {
    return (
      <div style={{ padding: embedded ? 0 : "20px 16px 100px" }}>
        {!embedded && (
          <>
            <Link href="/payroll-compliance" style={{ fontSize: 12, color: "#64748b" }}>
              ← Payroll Compliance
            </Link>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>UIF declaration</h1>
          </>
        )}
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, textAlign: "center", fontSize: 13, color: "#64748b" }}>
          👷 No employees registered. Add them in{" "}
          <Link href="/staff" style={{ color: "#0C4A6E", fontWeight: 700 }}>
            Staff Register
          </Link>{" "}
          first — UIF is only declared once you have staff on payroll.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: embedded ? 0 : "20px 16px 100px" }}>
      {!embedded && (
        <>
          <Link href="/payroll-compliance" style={{ fontSize: 12, color: "#64748b" }}>
            ← Payroll Compliance
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>UIF declaration</h1>
        </>
      )}

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
          {label} · {employeesPaid} employee{employeesPaid !== 1 ? "s" : ""}
        </div>
        {[
          ["UIF — employee (1%)", uifEmployee],
          ["UIF — employer (1%)", uifEmployer],
        ].map(([l, v]) => (
          <div key={l as string} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "#7DD3FC" }}>{l}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{fmt(v as number)}</span>
          </div>
        ))}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, color: "#38BDF8", fontWeight: 700 }}>Total UIF</span>
          <span style={{ fontSize: 24, color: "#fff", fontWeight: 900 }}>{fmt(total)}</span>
        </div>
        <div style={{ fontSize: 11, color: "#38BDF8", marginTop: 8 }}>Due {dueDate}</div>
      </div>

      <FilingActions
        filingType="uif201"
        periodLabel={label}
        amount={total}
        markLabel="Mark UIF declaration as filed"
        hasData={monthRuns.length > 0}
        emptyLabel={`No pay runs recorded for ${label}.`}
        note="Declare on uFiling (Department of Employment & Labour) — this is a calculation aid, not a filing. Submit a UI-19 whenever someone joins or leaves."
        filename={`uif-${monthKey}`}
        pdf={() => ({ kind: "uif201", data: uif201PdfData(), asAt: asAtLabel() })}
        fallbackHtml={(b, w) => buildUif201HTML(b, uif201PdfData(), asAtLabel(), w)}
        share={handleShare}
      />

      {monthRuns.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Pay runs in {label}</div>
          {monthRuns.map((p) => (
            <div key={p.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{p.worker_name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0C4A6E" }}>{fmt(Number(p.uif_employee ?? 0) + Number(p.uif_employer ?? 0))}</span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {p.pay_date} · employee {fmt(p.uif_employee ?? 0)} · employer {fmt(p.uif_employer ?? 0)}
              </div>
            </div>
          ))}
        </>
      )}

      <FilingHistory filingType="uif201" filings={filings ?? []} />
    </div>
  );
}
