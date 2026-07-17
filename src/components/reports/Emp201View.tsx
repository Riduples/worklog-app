"use client";

import { useState } from "react";
import Link from "next/link";
import { usePayRuns } from "@/lib/supabase/hooks/usePayRuns";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTaxFilings, useMarkFiled } from "@/lib/supabase/hooks/useTaxFilings";
import { Row } from "@/components/ui/Row";
import { fmt } from "@/lib/format";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function Emp201View() {
  const { data: business } = useBusinessProfile();
  const { data: staff } = useStaffRegister();
  const { data: payRuns } = usePayRuns();
  const { data: filings } = useTaxFilings();
  const markFiled = useMarkFiled();

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
  const totalDue = paye + uifEmployee + uifEmployer + sdl;
  const employeesPaid = new Set(monthRuns.map((p) => p.staff_id)).size;

  const emp201Filings = (filings ?? []).filter((f) => f.filing_type === "emp201");
  const alreadyFiled = emp201Filings.some((f) => f.period_label === label);

  // EMP201 is due by the 7th of the month after the pay month.
  const dueMonth0 = (month0 + 1) % 12;
  const dueYear = month0 === 11 ? year + 1 : year;
  const dueDate = `7 ${MONTH_NAMES[dueMonth0]} ${dueYear}`;

  if ((staff ?? []).length === 0) {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <Link href="/tax" style={{ fontSize: 12, color: "#64748b" }}>
          ← Tax &amp; Compliance
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
        ← Tax &amp; Compliance
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
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, color: "#38BDF8", fontWeight: 700 }}>Total due to SARS</span>
          <span style={{ fontSize: 24, color: "#fff", fontWeight: 900 }}>{fmt(totalDue)}</span>
        </div>
        <div style={{ fontSize: 11, color: "#38BDF8", marginTop: 8 }}>Due {dueDate}</div>
      </div>

      {!business?.paye_ref && (
        <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400e" }}>
          ⚠️ No PAYE reference number set. Add it in{" "}
          <Link href="/tax" style={{ color: "#92400e", fontWeight: 700 }}>
            Business Details
          </Link>{" "}
          — SARS requires it on every EMP201 submission.
        </div>
      )}

      {monthRuns.length === 0 ? (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 14, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
          No pay runs recorded for {label}.
        </div>
      ) : alreadyFiled ? (
        <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#0369A1" }}>
          ✅ Marked as filed for {label}
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
    </div>
  );
}
