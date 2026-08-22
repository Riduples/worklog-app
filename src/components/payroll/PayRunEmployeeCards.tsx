"use client";

import { CalcNote } from "@/components/payroll/CalcNote";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Row } from "@/components/ui/Row";
import { fmt } from "@/lib/format";
import type { LeaveBalances } from "@/lib/payroll";
import type { ComputedRun, Draft } from "@/lib/payrunDraft";

// The per-employee halves of steps 3 and 4. A pay run covers everyone you ticked,
// so each step is a stack of these — one card per person, opened one at a time.

const cardStyle: React.CSSProperties = { background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 14, marginBottom: 10 };

function Toggle({ open, on, label, hint, onClick }: { open: boolean; on: boolean; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: "100%", background: on ? "#F0F9FF" : "#f8fafc", border: `1.5px solid ${on ? "#BAE6FD" : "#e2e8f0"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}
    >
      <span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>{label}</span>
        {hint && <span style={{ display: "block", fontSize: 11, color: "#b45309", marginTop: 1 }}>{hint}</span>}
      </span>
      <span style={{ color: "#94a3b8" }}>{open ? "▲" : "▼"}</span>
    </button>
  );
}

export function EarningsCard({ run, onChange }: { run: ComputedRun; onChange: (patch: Partial<Draft>) => void }) {
  const { draft, days, rates, money } = run;
  const unitWord = rates.unitLabel === "hours" ? "Hours" : "Days";
  const otUnits = Number(draft.otUnits) || 0;

  return (
    <div style={cardStyle}>
      <Field label={`${unitWord} paid`}>
        <Input type="number" value={draft.unitsInput} onChange={(v) => onChange({ unitsInput: v })} placeholder={String(days.units)} />
        <div style={{ fontSize: 11, color: run.unitsAreAuto ? "#0369A1" : "#b45309", marginTop: 4, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <span>
            {run.unitsAreAuto
              ? `Calculated ${days.units} ${rates.unitLabel} — edit only if this month was different`
              : `You've set ${run.units} ${rates.unitLabel}; the calculation says ${days.units}`}
          </span>
          {!run.unitsAreAuto && (
            <button type="button" onClick={() => onChange({ unitsInput: "" })} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "4px 8px", fontSize: 11, fontWeight: 700, color: "#0369A1", cursor: "pointer", whiteSpace: "nowrap" }}>
              ↩︎ Use {days.units}
            </button>
          )}
        </div>
      </Field>

      <CalcNote title={`How ${days.units} ${rates.unitLabel} was worked out`} lines={days.lines} defaultOpen />
      <CalcNote title={`How ${fmt(rates.unitRate)}/${rates.unitLabel === "hours" ? "hour" : "day"} was worked out`} lines={rates.lines} />

      {money.basic > 0 && (
        <div style={{ background: "#F0F9FF", borderRadius: 10, padding: "9px 12px", marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#0369A1" }}>
            Basic: {run.units} {rates.unitLabel} × {fmt(rates.unitRate)}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0C4A6E", whiteSpace: "nowrap" }}>{fmt(money.basic)}</span>
        </div>
      )}

      <Toggle
        open={draft.showOT}
        on={draft.showOT || money.overtime > 0}
        label="+ Overtime / extra days / public holiday"
        hint={money.overtime > 0 && !draft.showOT ? `${fmt(money.overtime)} added` : undefined}
        onClick={() => onChange({ showOT: !draft.showOT })}
      />
      {draft.showOT && (
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 8 }}>
          {/* Overtime is counted in hours or in whole days — a crew boss counts
              "he worked the Sunday", a site with a clock counts hours. Hours are
              priced off the hourly rate (the daily wage ÷ hours a day for staff
              who aren't on an hourly rate, which is how the BCEA derives it). */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="How much">
              <Input type="number" value={draft.otUnits} onChange={(v) => onChange({ otUnits: v })} placeholder="0" />
            </Field>
            <Field label="Counted in">
              <select
                value={draft.otBasis}
                onChange={(e) => onChange({ otBasis: e.target.value as Draft["otBasis"] })}
                style={{ width: "100%", padding: "13px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, background: "#fff" }}
              >
                <option value="hours">Hours</option>
                <option value="days">Whole days</option>
              </select>
            </Field>
          </div>
          <Field label="Rate">
            <select
              value={draft.otMultiplier}
              onChange={(e) => onChange({ otMultiplier: e.target.value })}
              style={{ width: "100%", padding: "13px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, background: "#fff" }}
            >
              <option value="1.5">1.5× — Standard overtime</option>
              <option value="2">2× — Public holiday / Sunday worked</option>
              <option value="1">1× — Normal rate (extra shift)</option>
            </select>
          </Field>

          {otUnits > 0 && (
            <>
              <div style={{ background: "#F0F9FF", borderRadius: 9, padding: "8px 11px", marginBottom: 8, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
                {run.overtime.explain}
              </div>
              <CalcNote title="How the overtime was worked out" lines={run.overtime.lines} />
            </>
          )}

          <Field label="Or type the overtime amount yourself (R)">
            <Input type="number" value={draft.otAmountInput} onChange={(v) => onChange({ otAmountInput: v })} placeholder={String(run.overtime.amount.toFixed(2))} />
            <div style={{ fontSize: 11, color: run.overtimeIsAuto ? "#94a3b8" : "#b45309", marginTop: 4 }}>
              {run.overtimeIsAuto
                ? "Leave this empty to use the calculation above."
                : `Using ${fmt(run.overtimeAmount)} instead of the calculated ${fmt(run.overtime.amount)}.`}
            </div>
          </Field>
          {!run.overtimeIsAuto && (
            <button type="button" onClick={() => onChange({ otAmountInput: "" })} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "#0369A1", cursor: "pointer" }}>
              ↩︎ Back to the calculated {fmt(run.overtime.amount)}
            </button>
          )}
          {draft.otMultiplier === "2" && (
            <div style={{ fontSize: 11, color: "#0369A1", marginTop: 8, lineHeight: 1.5 }}>BCEA: work on a public holiday or Sunday is paid at double the normal rate.</div>
          )}
        </div>
      )}

      <Toggle
        open={draft.showAllowance}
        on={draft.showAllowance || money.allowance > 0}
        label="+ Allowance"
        hint={money.allowance > 0 && !draft.showAllowance ? `${fmt(money.allowance)} added` : undefined}
        onClick={() => onChange({ showAllowance: !draft.showAllowance })}
      />
      {draft.showAllowance && (
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Amount (R)">
              <Input type="number" value={draft.allowance} onChange={(v) => onChange({ allowance: v })} placeholder="0" />
            </Field>
            <Field label="Description">
              <Input value={draft.allowanceDesc} onChange={(v) => onChange({ allowanceDesc: v })} placeholder="Travel, Meal..." />
            </Field>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            {Number(run.worker.recurring_allowance ?? 0) > 0
              ? "🔁 Pulled from this person's setup — edit or clear for this run only (won't change their setup)."
              : "One-off allowance for this pay run only; set a monthly one in Staff Register."}
          </div>
        </div>
      )}

      <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "11px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12.5, color: "#38BDF8", fontWeight: 700 }}>Gross wages</span>
        <span style={{ fontSize: 18, color: "#fff", fontWeight: 900, whiteSpace: "nowrap" }}>{fmt(money.gross)}</span>
      </div>
    </div>
  );
}

export function DeductionsCard({
  run,
  onChange,
  uifRatePct,
  payeThreshold,
  leaveBalances,
}: {
  run: ComputedRun;
  onChange: (patch: Partial<Draft>) => void;
  uifRatePct: string;
  payeThreshold: string;
  leaveBalances: LeaveBalances | null;
}) {
  const { draft, money, worker } = run;
  const registerPaid = run.registerLeave.paidDays;
  const registerUnpaid = run.registerLeave.unpaidDays;

  return (
    <div style={cardStyle}>
      <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Statutory (auto-calculated)</div>
        {worker.is_contractor ? (
          <div style={{ fontSize: 12, color: "#92400e", fontWeight: 600, background: "#fff7ed", borderRadius: 8, padding: "8px 10px" }}>
            🧾 Independent contractor — no UIF, no PAYE deductions. They handle their own tax and UIF.
          </div>
        ) : (
          <>
            <Row label={`UIF (employee ${uifRatePct})`} value={`−${fmt(money.uifEmployee)}`} />
            {money.paye > 0 ? (
              <Row label="PAYE" value={`−${fmt(money.paye)}`} bold />
            ) : (
              <div style={{ fontSize: 11, color: "#0369A1", marginTop: 4 }}>{`✅ No PAYE — below ${payeThreshold}/month threshold`}</div>
            )}
          </>
        )}
      </div>

      {run.loanBalance > 0 && (
        <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>💰 Outstanding advance: {fmt(run.loanBalance)}</div>
          <Field label="Deduct from this pay run (R)">
            <Input type="number" value={draft.loanDeduction} onChange={(v) => onChange({ loanDeduction: v })} placeholder="0.00" />
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => onChange({ loanDeduction: String(Math.min(run.loanBalance, money.gross).toFixed(2)) })}
              style={{ flex: 1, background: "#b45309", border: "none", borderRadius: 8, padding: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#fff" }}
            >
              Deduct all ({fmt(Math.min(run.loanBalance, money.gross))})
            </button>
            <button type="button" onClick={() => onChange({ loanDeduction: "" })} style={{ flex: 1, background: "#f1f5f9", border: "none", borderRadius: 8, padding: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#64748b" }}>
              None this time
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#92400e", marginTop: 8 }}>
            After this run: <strong>{fmt(run.loanBalanceAfter)}</strong> still owing{run.loanBalanceAfter === 0 && money.loanDeduction > 0 ? " — settled in full" : ""}
          </div>
        </div>
      )}

      {/* Leave already captured in the Leave tool is READ ONLY here. It has
          already lowered their balance, and this run must not record it a second
          time — the old wizard pre-filled it into the same field it then wrote
          back, which double-counted the days. Anything not yet captured goes in
          below and is recorded once, by this run. */}
      {(registerPaid > 0 || registerUnpaid > 0) && (
        <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "11px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0369A1", marginBottom: 6 }}>🏖️ Leave already recorded for this period</div>
          {run.registerLeave.entries.map((e, i) => (
            <div key={`${e.start_date}-${i}`} style={{ fontSize: 11.5, color: "#0C4A6E", marginBottom: 2 }}>
              {e.leave_type} — {e.countedDays} day{e.countedDays === 1 ? "" : "s"} from {e.start_date}
              {e.leave_type === "Unpaid" ? " · taken off the days paid" : " · paid in full"}
            </div>
          ))}
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>Pulled from the Leave tool — not recorded again by this run.</div>
        </div>
      )}

      <Toggle
        open={draft.showLeave}
        on={draft.showLeave || Number(draft.extraLeaveDays) > 0}
        label="🏖️ Leave not yet recorded?"
        hint={leaveBalances ? `Annual ${leaveBalances.annualBalance}d · Sick ${leaveBalances.sickBalance}d · Family ${leaveBalances.familyBalance}d left` : undefined}
        onClick={() => onChange({ showLeave: !draft.showLeave })}
      />
      {draft.showLeave && (
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Leave type">
              <select
                value={draft.extraLeaveType}
                onChange={(e) => onChange({ extraLeaveType: e.target.value })}
                style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, background: "#fff" }}
              >
                <option value="Annual">Annual leave</option>
                <option value="Sick">Sick leave</option>
                <option value="Family">Family responsibility</option>
                <option value="Unpaid">Unpaid leave</option>
              </select>
            </Field>
            <Field label="Days">
              <Input type="number" value={draft.extraLeaveDays} onChange={(v) => onChange({ extraLeaveDays: v })} placeholder="0" />
            </Field>
          </div>
          <div style={{ fontSize: 11, color: draft.extraLeaveType === "Unpaid" ? "#b45309" : "#94a3b8", lineHeight: 1.5 }}>
            {draft.extraLeaveType === "Unpaid"
              ? "Unpaid days come off the days paid above, so the gross, UIF and PAYE all drop with them."
              : "Paid leave doesn't change the wage — it's recorded against their balance."}
          </div>
          {run.extraUnpaidLeaveDays > 0 && (
            <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 8, padding: "8px 10px", marginTop: 8, fontSize: 12, color: "#be123c", fontWeight: 600 }}>
              {run.extraUnpaidLeaveDays} unpaid day{run.extraUnpaidLeaveDays === 1 ? "" : "s"} × {fmt(run.rates.dailyRate)} = −{fmt(run.extraUnpaidLeaveDays * run.rates.dailyRate)} off the basic
            </div>
          )}
        </div>
      )}

      <Toggle
        open={draft.showOtherDed}
        on={draft.showOtherDed || money.otherDeduction > 0}
        label="− Other deduction"
        hint={money.otherDeduction > 0 && !draft.showOtherDed ? `−${fmt(money.otherDeduction)}` : undefined}
        onClick={() => onChange({ showOtherDed: !draft.showOtherDed })}
      />
      {draft.showOtherDed && (
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Amount (R)">
              <Input type="number" value={draft.otherDeduction} onChange={(v) => onChange({ otherDeduction: v })} placeholder="0" />
            </Field>
            <Field label="Description">
              <Input value={draft.otherDeductionDesc} onChange={(v) => onChange({ otherDeductionDesc: v })} placeholder="Uniform, Tools..." />
            </Field>
          </div>
        </div>
      )}

      <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "11px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12.5, color: "#38BDF8", fontWeight: 700 }}>Net pay</span>
        <span style={{ fontSize: 18, color: "#fff", fontWeight: 900, whiteSpace: "nowrap" }}>{fmt(money.net)}</span>
      </div>
    </div>
  );
}
