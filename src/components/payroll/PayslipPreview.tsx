"use client";

import { useState } from "react";
import { Row } from "@/components/ui/Row";
import { CalcNote } from "@/components/payroll/CalcNote";
import { fmt } from "@/lib/format";
import type { LeaveBalances } from "@/lib/payroll";
import type { PayPeriod } from "@/lib/payrunCalc";
import type { ComputedRun, Draft } from "@/lib/payrunDraft";

// The payslip as the employee will see it — and, folded underneath it, every sum
// that produced it, with the figures still editable.
//
// The rows used to be unreadable: Row paints its label #374151 and its value
// #0C4A6E, and this card is #0C4A6E, so the entire payslip was navy-on-navy and
// only NET PAY — which carries its own colours — could be made out. tone="dark"
// is the fix; nothing here relies on the default palette.

function MiniLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: "#7DD3FC", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{children}</div>;
}

function MiniInput({ value, onChange, placeholder, type = "number" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: "100%", padding: "9px 10px", borderRadius: 9, border: "1.5px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, boxSizing: "border-box", outline: "none" }}
    />
  );
}

function ResetBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, padding: "5px 9px", fontSize: 11, fontWeight: 700, color: "#7DD3FC", cursor: "pointer", marginTop: 6 }}
    >
      {children}
    </button>
  );
}

export function PayslipPreview({
  run,
  payPeriod,
  payDate,
  periodStart,
  periodEnd,
  leaveBalances,
  onChange,
  editable = true,
}: {
  run: ComputedRun;
  payPeriod: PayPeriod;
  payDate: string;
  periodStart: string;
  periodEnd: string;
  leaveBalances: LeaveBalances | null;
  onChange: (patch: Partial<Draft>) => void;
  editable?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const { worker, money, days, rates, draft } = run;
  const unitWord = rates.unitLabel === "hours" ? "hours" : "days";

  return (
    <div style={{ background: "#0C4A6E", borderRadius: 16, padding: "16px 18px", marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#fff" }}>{worker.full_name}</div>
          <div style={{ fontSize: 12, color: "#7DD3FC", marginTop: 2 }}>
            {payPeriod} · {periodStart} → {periodEnd}
          </div>
          <div style={{ fontSize: 11, color: "#BAE6FD", marginTop: 1 }}>Paid {payDate}</div>
        </div>
        {worker.is_contractor && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 8, background: "rgba(245,158,11,0.25)", color: "#FCD34D", whiteSpace: "nowrap" }}>Contractor</span>
        )}
      </div>

      <Row tone="dark" label={`Basic (${run.units} ${unitWord} × ${fmt(rates.unitRate)})`} value={fmt(money.basic)} />
      {money.overtime > 0 && (
        <Row
          tone="dark"
          label={run.overtimeIsAuto ? `Overtime (${draft.otUnits || 0} ${draft.otBasis === "hours" ? "hrs" : "days"} × ${draft.otMultiplier}×)` : "Overtime (entered)"}
          value={fmt(money.overtime)}
        />
      )}
      {money.allowance > 0 && <Row tone="dark" label={draft.allowanceDesc || "Allowance"} value={fmt(money.allowance)} />}
      <Row tone="dark" label="Gross wages" value={fmt(money.gross)} bold />

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", marginTop: 8, paddingTop: 8 }}>
        {worker.is_contractor ? (
          <div style={{ fontSize: 11.5, color: "#FCD34D" }}>Independent contractor — no UIF or PAYE deducted.</div>
        ) : (
          <>
            <Row tone="dark" label="UIF (employee 1%)" value={`−${fmt(money.uifEmployee)}`} />
            {money.paye > 0 && <Row tone="dark" label="PAYE" value={`−${fmt(money.paye)}`} />}
          </>
        )}
        {money.loanDeduction > 0 && <Row tone="dark" label="Advance repayment" value={`−${fmt(money.loanDeduction)}`} />}
        {money.otherDeduction > 0 && <Row tone="dark" label={draft.otherDeductionDesc || "Other deduction"} value={`−${fmt(money.otherDeduction)}`} />}
      </div>

      {(run.registerLeave.paidDays > 0 || run.unpaidLeaveDays > 0) && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", marginTop: 8, paddingTop: 8 }}>
          {run.registerLeave.paidDays + run.extraPaidLeaveDays > 0 && (
            <Row
              tone="dark"
              label={`Paid leave (${Object.entries({ ...run.registerLeave.paidByType }).map(([t, d]) => `${t} ${d}d`).join(", ") || `${run.extraPaidLeaveDays}d`})`}
              value="paid in full"
            />
          )}
          {/* Not written as "−R x": it is NOT a deduction from the net below.
              The days are already out of the basic, so a minus here would read as
              a second bite at the same money. */}
          {run.unpaidLeaveDays > 0 && (
            <Row tone="dark" label={`Unpaid leave (${run.unpaidLeaveDays}d) — already off the days`} value={`${fmt(run.unpaidLeaveValue)} not earned`} />
          )}
        </div>
      )}

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14, color: "#38BDF8", fontWeight: 700 }}>NET PAY (take-home)</span>
        <span style={{ fontSize: 24, color: "#fff", fontWeight: 900, whiteSpace: "nowrap" }}>{fmt(money.net)}</span>
      </div>

      {/* For reference on the slip itself — what's still owed on their advance,
          which is the question every employee asks the day after a deduction. */}
      {(run.loanBalance > 0 || money.loanDeduction > 0) && (
        <div style={{ background: "rgba(245,158,11,0.15)", borderRadius: 10, padding: "8px 11px", marginTop: 10, fontSize: 11.5, color: "#FCD34D", lineHeight: 1.5 }}>
          💰 Advance: {fmt(run.loanBalance)} owing{money.loanDeduction > 0 ? ` · less ${fmt(money.loanDeduction)} this run` : ""} ·{" "}
          <span style={{ fontWeight: 800 }}>{fmt(run.loanBalanceAfter)} still owing</span>
        </div>
      )}
      {leaveBalances && !worker.is_contractor && (
        <div style={{ fontSize: 11, color: "#BAE6FD", marginTop: 8 }}>
          🏖️ Leave left: Annual {leaveBalances.annualBalance}d · Sick {leaveBalances.sickBalance}d · Family {leaveBalances.familyBalance}d
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <CalcNote tone="dark" title={`How the ${unitWord} were worked out`} lines={days.lines} />
        <CalcNote tone="dark" title="How the rate was worked out" lines={rates.lines} />
        {money.overtime > 0 && run.overtimeIsAuto && <CalcNote tone="dark" title="How the overtime was worked out" lines={run.overtime.lines} />}
      </div>

      {editable && (
        <>
          <button
            type="button"
            onClick={() => setEditing((p) => !p)}
            style={{ width: "100%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", marginTop: 4 }}
          >
            {editing ? "Done adjusting" : "✎ Adjust these figures"}
          </button>
          {editing && (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <div>
                <MiniLabel>{unitWord} paid</MiniLabel>
                <MiniInput value={draft.unitsInput} onChange={(v) => onChange({ unitsInput: v })} placeholder={String(days.units)} />
                <div style={{ fontSize: 11, color: run.unitsAreAuto ? "#BAE6FD" : "#FCD34D", marginTop: 4 }}>
                  {run.unitsAreAuto ? `Calculated: ${days.units} ${unitWord}` : `Overriding the calculated ${days.units} ${unitWord}`}
                </div>
                {!run.unitsAreAuto && <ResetBtn onClick={() => onChange({ unitsInput: "" })}>↩︎ Back to calculated</ResetBtn>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <MiniLabel>Overtime</MiniLabel>
                  <MiniInput value={draft.otUnits} onChange={(v) => onChange({ otUnits: v })} placeholder="0" />
                </div>
                <div>
                  <MiniLabel>Counted in</MiniLabel>
                  <select
                    value={draft.otBasis}
                    onChange={(e) => onChange({ otBasis: e.target.value as Draft["otBasis"] })}
                    style={{ width: "100%", padding: "9px 10px", borderRadius: 9, border: "1.5px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 13 }}
                  >
                    <option style={{ color: "#111" }} value="hours">Hours</option>
                    <option style={{ color: "#111" }} value="days">Days</option>
                  </select>
                </div>
              </div>
              {Number(draft.otUnits) > 0 && (
                <div style={{ fontSize: 11, color: "#BAE6FD", marginTop: -4 }}>
                  {run.overtime.explain}
                  {!run.overtimeIsAuto && <span style={{ color: "#FCD34D" }}> · overridden with {fmt(run.overtimeAmount)}</span>}
                </div>
              )}

              <div>
                <MiniLabel>Allowance</MiniLabel>
                <MiniInput value={draft.allowance} onChange={(v) => onChange({ allowance: v })} placeholder="0" />
              </div>

              {run.loanBalance > 0 && (
                <div>
                  <MiniLabel>Advance repayment</MiniLabel>
                  <MiniInput value={draft.loanDeduction} onChange={(v) => onChange({ loanDeduction: v })} placeholder="0" />
                  <div style={{ fontSize: 11, color: "#BAE6FD", marginTop: 4 }}>{fmt(run.loanBalance)} owing — leaves {fmt(run.loanBalanceAfter)}</div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
