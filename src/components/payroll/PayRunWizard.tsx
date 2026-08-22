"use client";

import { useState } from "react";
import Link from "next/link";
import { useStaffRegister, type StaffMember } from "@/lib/supabase/hooks/useStaffRegister";
import { useWorkerLoans } from "@/lib/supabase/hooks/useWorkerLoans";
import { useWorkerLeave } from "@/lib/supabase/hooks/useWorkerLeave";
import { usePayRuns, useCreatePayRun } from "@/lib/supabase/hooks/usePayRuns";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useCurrentMember } from "@/lib/supabase/hooks/useCurrentMember";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { Row } from "@/components/ui/Row";
import { DocumentActions } from "@/components/ui/DocumentActions";
import { EarningsCard, DeductionsCard } from "@/components/payroll/PayRunEmployeeCards";
import { PayslipPreview } from "@/components/payroll/PayslipPreview";
import { fmt, todayStr } from "@/lib/format";
import { calcLeaveBalances } from "@/lib/payroll";
import { periodForPayDate, type PayPeriod } from "@/lib/payrunCalc";
import { computeRun, draftForWorker, loanBalanceOf, EMPTY_DRAFT, type ComputedRun, type Draft } from "@/lib/payrunDraft";
import { buildPayslipDoc } from "@/lib/payslipDoc";
import { canApprove } from "@/lib/permissions";
import { isRestricted, TIERS, type Plan } from "@/lib/tiers";
import { useTaxRates } from "@/lib/taxRates";
import { BackButton } from "@/components/ui/BackLink";

const STEP_LABELS = ["Employees", "Period", "Earnings", "Deductions", "Summary"];

function StepBar({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
      {STEP_LABELS.map((s, i) => (
        <div key={s} style={{ flex: 1, textAlign: "center" }}>
          <div style={{ height: 4, borderRadius: 2, background: step > i + 1 ? "#0C4A6E" : step === i + 1 ? "#F59E0B" : "#e2e8f0", marginBottom: 4 }} />
          <div style={{ fontSize: 9, color: step === i + 1 ? "#0C4A6E" : "#94a3b8", fontWeight: step === i + 1 ? 700 : 400 }}>{s}</div>
        </div>
      ))}
    </div>
  );
}

function NextBtn({ label, onClick, disabled }: { label?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{ width: "100%", background: disabled ? "#94a3b8" : "#0C4A6E", border: "none", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, cursor: disabled ? "default" : "pointer", color: "#fff", marginTop: 8 }}
    >
      {label || "Next →"}
    </button>
  );
}

// The wizard's header. Its back arrow returns to the pay-run list (onExit),
// not out of the tool — the list is now the tool's home.
const Header = ({ onExit, count }: { onExit: () => void; count: number }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
    <div>
      <BackButton onClick={onExit} />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "8px 0 0" }}>New Pay Run</h1>
      {count > 0 && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{count} employee{count === 1 ? "" : "s"} in this run</div>}
    </div>
  </div>
);

// Kept as a local wrapper only to hold the wizard's own spacing — the step bar
// above it and the step's content below both need more room than the tool pages
// leave. The control itself is the shared one.
function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <BackButton onClick={onClick} />
    </div>
  );
}

/**
 * One pay run, any number of employees.
 *
 * It used to be one person per run, so paying a crew of six meant walking the
 * same five steps six times over and reconciling the totals by hand. Now the
 * period is chosen once and each person gets their own card under Earnings and
 * Deductions, their own payslip on the Summary, and their own pay_runs row on
 * save — the batch is a wizard convenience, not a new kind of record, so every
 * payslip, EMP201 line and void still works exactly as it did.
 */
export function PayRunWizard({ onExit }: { onExit: () => void }) {
  const { data: staff } = useStaffRegister();
  const { data: loans } = useWorkerLoans();
  const { data: leaveRecords } = useWorkerLeave();
  const { data: payRuns } = usePayRuns();
  const { data: business } = useBusinessProfile();
  const { data: currentMember } = useCurrentMember();
  const taxRates = useTaxRates();
  const createPayRun = useCreatePayRun();

  const [step, setStep] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [payPeriod, setPayPeriod] = useState<PayPeriod>("Monthly");
  const [payDate, setPayDate] = useState(todayStr());
  const initialPeriod = periodForPayDate(todayStr(), "Monthly");
  const [periodStart, setPeriodStart] = useState(initialPeriod.start);
  const [periodEnd, setPeriodEnd] = useState(initialPeriod.end);
  // Once the dates are touched by hand they stop following the pay date around —
  // an owner who set 26 July → 25 August meant it.
  const [periodEdited, setPeriodEdited] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [savedRuns, setSavedRuns] = useState<Record<string, { id: string; payslip_number: string | null }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const plan = (business?.plan ?? "solo") as Plan;
  const payRunRestriction = isRestricted(plan, "payrun");
  const member = currentMember ?? { role: "owner", permissions: {} };
  const canApproveRun = canApprove(member, "payrun");

  const allStaff = staff ?? [];
  const selected = allStaff.filter((w) => selectedIds.includes(w.id));
  const savedCount = Object.keys(savedRuns).length;
  const allSaved = selected.length > 0 && selected.every((w) => savedRuns[w.id]);

  const loansFor = (id: string) => (loans ?? []).filter((l) => l.staff_id === id);
  const leaveFor = (id: string) => (leaveRecords ?? []).filter((l) => l.staff_id === id);

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? EMPTY_DRAFT), ...patch } }));

  // Ticking someone pulls their standing setup (allowance, agreed advance
  // repayment) into a fresh draft; unticking drops it. A draft they've already
  // edited survives a re-tick within the same run.
  const toggleWorker = (w: StaffMember) => {
    if (selectedIds.includes(w.id)) {
      setSelectedIds((ids) => ids.filter((i) => i !== w.id));
      return;
    }
    setDrafts((d) => (d[w.id] ? d : { ...d, [w.id]: draftForWorker(w, loansFor(w.id)) }));
    setSelectedIds((ids) => (ids.includes(w.id) ? ids : [...ids, w.id]));
  };

  const selectAll = () => {
    const payable = allStaff.filter((w) => !w.terminated);
    setDrafts((d) => {
      const next = { ...d };
      for (const w of payable) if (!next[w.id]) next[w.id] = draftForWorker(w, loansFor(w.id));
      return next;
    });
    setSelectedIds(payable.map((w) => w.id));
  };

  const applyPeriod = (date: string, type: PayPeriod) => {
    if (periodEdited) return;
    const p = periodForPayDate(date, type);
    setPeriodStart(p.start);
    setPeriodEnd(p.end);
  };
  const changePayDate = (v: string) => {
    setPayDate(v);
    applyPeriod(v, payPeriod);
  };
  const changePayPeriod = (v: PayPeriod) => {
    setPayPeriod(v);
    applyPeriod(payDate, v);
  };
  const resetPeriod = () => {
    const p = periodForPayDate(payDate, payPeriod);
    setPeriodStart(p.start);
    setPeriodEnd(p.end);
    setPeriodEdited(false);
  };
  const autoPeriod = periodForPayDate(payDate, payPeriod);
  const periodIsAuto = periodStart === autoPeriod.start && periodEnd === autoPeriod.end;

  const rows: ComputedRun[] = selected.map((w) =>
    computeRun({
      worker: w,
      draft: drafts[w.id] ?? EMPTY_DRAFT,
      periodStart,
      periodEnd,
      payPeriod,
      leaveRecords: leaveFor(w.id),
      loanBalance: loanBalanceOf(loansFor(w.id)),
      sdlRegistered: !!business?.sdl_registered,
      sdlRate: taxRates.SDL_RATE,
      calcUIF: taxRates.calcUIF,
      calcPAYE: taxRates.calcMonthlyPAYE,
    })
  );

  const totals = rows.reduce(
    (t, r) => ({
      gross: t.gross + r.money.gross,
      net: t.net + r.money.net,
      paye: t.paye + r.money.paye,
      uifEmployee: t.uifEmployee + r.money.uifEmployee,
      uifEmployer: t.uifEmployer + r.money.uifEmployer,
      sdl: t.sdl + r.money.sdl,
      loans: t.loans + r.money.loanDeduction,
    }),
    { gross: 0, net: 0, paye: 0, uifEmployee: 0, uifEmployer: 0, sdl: 0, loans: 0 }
  );

  const leaveBalancesFor = (r: ComputedRun) => {
    if (r.worker.is_contractor) return null;
    const entries = [
      ...leaveFor(r.worker.id).map((l) => ({ leave_type: l.leave_type, days: l.days, date: l.start_date })),
      ...(payRuns ?? [])
        .filter((p) => p.staff_id === r.worker.id && (p.leave_days ?? 0) > 0)
        .map((p) => ({ leave_type: p.leave_type ?? "Annual", days: p.leave_days ?? 0, date: p.pay_date })),
    ];
    return calcLeaveBalances(r.worker.start_date ?? null, entries);
  };

  /**
   * Save every employee's run.
   *
   * One at a time, deliberately: create_pay_run numbers each payslip from
   * MAX(payslip_number) + 1, so firing six of them at once can hand two people
   * the same number. Already-saved people are skipped, so a retry after a
   * mid-batch failure finishes the batch instead of double-paying the first half.
   */
  const handleSaveAll = async (status: "prepared" | "approved") => {
    if (rows.length === 0) return;
    setSaving(true);
    setError("");
    try {
      for (const r of rows) {
        if (savedRuns[r.worker.id]) continue;
        // Only leave that ISN'T already in the Leave tool is recorded by the run —
        // the register's own rows already lowered the balance, and writing them
        // back here would count those days twice.
        const extraDays = r.extraUnpaidLeaveDays > 0 ? r.extraUnpaidLeaveDays : r.extraPaidLeaveDays;
        const extraType = r.extraUnpaidLeaveDays > 0 ? "Unpaid" : r.draft.extraLeaveType;
        const pr = await createPayRun.mutateAsync({
          staffId: r.worker.id,
          workerName: r.worker.full_name,
          payPeriod,
          payDate,
          unitsWorked: r.units,
          baseRate: r.rates.unitRate,
          overtimeAmount: r.money.overtime,
          allowancesAmount: r.money.allowance,
          grossWages: r.money.gross,
          uifEmployee: r.money.uifEmployee,
          uifEmployer: r.money.uifEmployer,
          paye: r.money.paye,
          sdl: r.money.sdl,
          loanDeducted: r.money.loanDeduction,
          otherDeductions: r.money.otherDeduction,
          otherDeductionDesc: r.money.otherDeduction > 0 ? r.draft.otherDeductionDesc : null,
          leaveDays: extraDays,
          leaveType: extraDays > 0 ? extraType : null,
          // For the record only. The unpaid days are already out of unitsWorked,
          // so the gross, UIF, PAYE and the wage expense are all the real ones —
          // this is not deducted again.
          unpaidLeaveAmount: r.unpaidLeaveValue,
          netPay: r.money.net,
          status,
        });
        setSavedRuns((s) => ({ ...s, [r.worker.id]: { id: pr.id, payslip_number: pr.payslip_number } }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the pay run.");
    } finally {
      setSaving(false);
    }
  };

  // ── STEP 1: EMPLOYEES ──
  if (step === 1) {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <Header onExit={onExit} count={selectedIds.length} />
        <StepBar step={step} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>Who are you paying?</div>
          {allStaff.length > 1 && (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={selectAll} style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 20, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, color: "#0369A1", cursor: "pointer" }}>
                Select all
              </button>
              {selectedIds.length > 0 && (
                <button onClick={() => setSelectedIds([])} style={{ background: "#f1f5f9", border: "1.5px solid #e2e8f0", borderRadius: 20, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, color: "#64748b", cursor: "pointer" }}>
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>Tick everyone on this run — they all share one period and each gets their own payslip.</div>

        {allStaff.length === 0 ? (
          <div style={{ background: "#f8fafc", borderRadius: 12, padding: 20, textAlign: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>
              No employees registered.{" "}
              <Link href="/staff" style={{ color: "#0C4A6E", fontWeight: 700 }}>
                Add them in Staff Register
              </Link>{" "}
              first.
            </div>
          </div>
        ) : (
          allStaff.map((w) => {
            const lastWage = (payRuns ?? []).filter((p) => p.staff_id === w.id)[0];
            const loanBal = loanBalanceOf(loansFor(w.id));
            const rate = w.pay_type === "Hourly" ? `${fmt(w.hourly_rate ?? 0)}/hr` : w.pay_type === "Monthly" ? `${fmt(w.monthly_salary ?? 0)}/mo` : `${fmt(w.daily_wage ?? 0)}/day`;
            const isSelected = selectedIds.includes(w.id);
            return (
              <button
                key={w.id}
                onClick={() => toggleWorker(w)}
                style={{ width: "100%", background: isSelected ? "#F0F9FF" : "#fff", border: `2px solid ${isSelected ? "#0C4A6E" : "#e2e8f0"}`, borderRadius: 14, padding: "14px 16px", marginBottom: 8, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <span
                    aria-hidden
                    style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${isSelected ? "#0C4A6E" : "#cbd5e1"}`, background: isSelected ? "#0C4A6E" : "#fff", color: "#fff", fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                  >
                    {isSelected ? "✓" : ""}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{w.full_name}</span>
                      {w.is_contractor && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: "#fff7ed", color: "#92400e", border: "1px solid #fed7aa" }}>🧾 Contractor</span>}
                      {w.terminated && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" }}>Left</span>}
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: "#94a3b8" }}>
                      {rate}
                      {lastWage ? ` · Last paid ${lastWage.pay_date}` : " · Not paid yet"}
                      {w.is_contractor ? " · No UIF or PAYE" : ""}
                    </span>
                  </span>
                </div>
                {loanBal > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#b45309", background: "#fff7ed", padding: "2px 8px", borderRadius: 8, whiteSpace: "nowrap" }}>Loan {fmt(loanBal)}</span>}
              </button>
            );
          })
        )}
        <NextBtn label={selectedIds.length > 1 ? `Next → Period (${selectedIds.length} people)` : "Next → Period"} disabled={selectedIds.length === 0} onClick={() => setStep(2)} />
      </div>
    );
  }

  // ── STEP 2: PERIOD ──
  if (step === 2) {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <Header onExit={onExit} count={selectedIds.length} />
        <StepBar step={step} />
        <BackBtn onClick={() => setStep(1)} />
        <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "11px 14px", marginBottom: 16, fontSize: 13, fontWeight: 700, color: "#0C4A6E" }}>
          {selected.map((w) => w.full_name).join(", ")}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 12 }}>Pay period</div>
        <Field label="Period type">
          <Chips options={["Weekly", "Fortnightly", "Monthly"]} selected={payPeriod} onSelect={(v) => v && changePayPeriod(v as PayPeriod)} />
        </Field>
        <Field label="Pay date">
          <Input type="date" value={payDate} onChange={changePayDate} />
        </Field>

        {/* The days worked are counted across these two dates, so they're on the
            screen and editable rather than assumed. They follow the pay date until
            you change them; "Reset" puts them back. */}
        <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Days are counted over this stretch</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Period from">
              <Input
                type="date"
                value={periodStart}
                onChange={(v) => {
                  setPeriodStart(v);
                  setPeriodEdited(true);
                }}
              />
            </Field>
            <Field label="Period to">
              <Input
                type="date"
                value={periodEnd}
                onChange={(v) => {
                  setPeriodEnd(v);
                  setPeriodEdited(true);
                }}
              />
            </Field>
          </div>
          <div style={{ fontSize: 11, color: periodIsAuto ? "#0369A1" : "#b45309", lineHeight: 1.5 }}>
            {periodIsAuto
              ? `Set from the pay date — the ${payPeriod === "Monthly" ? "calendar month" : payPeriod === "Weekly" ? "7 days" : "14 days"} it falls in.`
              : `You've set your own period. The suggestion was ${autoPeriod.start} → ${autoPeriod.end}.`}
          </div>
          {!periodIsAuto && (
            <button onClick={resetPeriod} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "#0369A1", cursor: "pointer", marginTop: 6 }}>
              ↩︎ Reset to {autoPeriod.start} → {autoPeriod.end}
            </button>
          )}
          {periodEnd < periodStart && <div style={{ fontSize: 12, color: "#be123c", fontWeight: 600, marginTop: 8 }}>The end date is before the start date.</div>}
        </div>

        <NextBtn label="Next → Earnings" disabled={periodEnd < periodStart} onClick={() => setStep(3)} />
      </div>
    );
  }

  // ── STEPS 3 & 4: one card per employee ──
  if (step === 3 || step === 4) {
    const isEarnings = step === 3;
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <Header onExit={onExit} count={selectedIds.length} />
        <StepBar step={step} />
        <BackBtn onClick={() => setStep(step - 1)} />
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 4 }}>{isEarnings ? "Earnings" : "Deductions"}</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
          {isEarnings
            ? `Days, overtime and allowances for ${periodStart} → ${periodEnd}. Everything is worked out for you and everything stays editable.`
            : "Statutory deductions are auto-calculated. Advances, leave and anything else go here."}
        </div>

        {rows.map((r) => {
          const isOpen = (openId ?? rows[0]?.worker.id) === r.worker.id;
          return (
            <div key={r.worker.id} style={{ marginBottom: 10 }}>
              <button
                onClick={() => setOpenId(isOpen ? "" : r.worker.id)}
                style={{ width: "100%", background: isOpen ? "#0C4A6E" : "#fff", border: `1.5px solid ${isOpen ? "#0C4A6E" : "#e2e8f0"}`, borderRadius: isOpen ? "14px 14px 0 0" : 14, padding: "12px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: isOpen ? "#fff" : "#111" }}>{r.worker.full_name}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: isOpen ? "#7DD3FC" : "#94a3b8", marginTop: 1 }}>
                    {r.units} {r.rates.unitLabel} × {fmt(r.rates.unitRate)}
                    {r.unpaidLeaveDays > 0 ? ` · ${r.unpaidLeaveDays}d unpaid leave` : ""}
                  </span>
                </span>
                <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: isOpen ? "#fff" : "#0C4A6E" }}>{fmt(isEarnings ? r.money.gross : r.money.net)}</span>
                  <span style={{ display: "block", fontSize: 10, color: isOpen ? "#7DD3FC" : "#94a3b8" }}>{isEarnings ? "gross" : "net"}</span>
                </span>
              </button>
              {isOpen &&
                (isEarnings ? (
                  <EarningsCard run={r} onChange={(patch) => setDraft(r.worker.id, patch)} />
                ) : (
                  <DeductionsCard
                    run={r}
                    onChange={(patch) => setDraft(r.worker.id, patch)}
                    uifRatePct={`${(taxRates.UIF_EMPLOYEE_RATE * 100).toFixed(0)}%`}
                    payeThreshold={fmt(taxRates.PAYE_MONTHLY_THRESHOLD)}
                    leaveBalances={leaveBalancesFor(r)}
                  />
                ))}
            </div>
          );
        })}

        <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "12px 16px", marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#38BDF8", fontWeight: 700 }}>{isEarnings ? "Total gross" : "Total net pay"}</span>
          <span style={{ fontSize: 20, color: "#fff", fontWeight: 900, whiteSpace: "nowrap" }}>{fmt(isEarnings ? totals.gross : totals.net)}</span>
        </div>
        <NextBtn label={isEarnings ? "Next → Deductions" : "Next → Summary"} onClick={() => setStep(step + 1)} />
      </div>
    );
  }

  // ── STEP 5: SUMMARY ──
  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <Header onExit={onExit} count={selectedIds.length} />
      <StepBar step={step} />
      <BackBtn onClick={() => setStep(4)} />

      {rows.length > 1 && (
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            This pay run · {rows.length} employees · {periodStart} → {periodEnd}
          </div>
          <Row label="Total gross wages" value={fmt(totals.gross)} />
          <Row label="PAYE withheld" value={`−${fmt(totals.paye)}`} />
          <Row label="UIF (employee)" value={`−${fmt(totals.uifEmployee)}`} />
          {totals.loans > 0 && <Row label="Advance repayments" value={`−${fmt(totals.loans)}`} />}
          <Row label="Total to pay out" value={fmt(totals.net)} bold />
        </div>
      )}

      {rows.map((r) => (
        <div key={r.worker.id}>
          <PayslipPreview
            run={r}
            payPeriod={payPeriod}
            payDate={payDate}
            periodStart={periodStart}
            periodEnd={periodEnd}
            leaveBalances={leaveBalancesFor(r)}
            onChange={(patch) => setDraft(r.worker.id, patch)}
            editable={!savedRuns[r.worker.id]}
          />
          {savedRuns[r.worker.id] && shareOpen && plan !== "solo" && (
            <div style={{ marginTop: -4, marginBottom: 14, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111", marginBottom: 6 }}>
                Payslip {savedRuns[r.worker.id].payslip_number} — {r.worker.full_name}
              </div>
              <DocumentActions
                doc={buildPayslipDoc({
                  run: r,
                  docNumber: savedRuns[r.worker.id].payslip_number ?? `PAY-${payDate}`,
                  payPeriod,
                  payDate,
                  periodStart,
                  periodEnd,
                  leaveBalances: leaveBalancesFor(r),
                })}
                kind="payslip"
                sourceId={savedRuns[r.worker.id].id}
                shareText={`Payslip for ${r.worker.full_name} — ${payPeriod} ${periodStart} to ${periodEnd}. Net pay: ${fmt(r.money.net)}.`}
              />
            </div>
          )}
        </div>
      ))}

      <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "11px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Your cost to SARS — pay by 7th</div>
        <Row label="UIF employer (1%)" value={fmt(totals.uifEmployer)} />
        {totals.sdl > 0 && <Row label="SDL (1%)" value={fmt(totals.sdl)} />}
        <Row label="Total" value={fmt(totals.uifEmployee + totals.uifEmployer + totals.sdl)} bold />
      </div>

      {payRunRestriction && (
        <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 10, padding: "9px 12px", marginBottom: 10, fontSize: 12, color: "#92400e" }}>
          <span style={{ fontWeight: 700 }}>{TIERS[plan].label} plan</span> — {payRunRestriction.message}
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 10 }}>{error}</p>}

      {savedCount > 0 && (
        <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 10, padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#0369A1" }}>
          <span style={{ fontSize: 16 }}>✅</span>
          <span>
            <span style={{ fontWeight: 700 }}>
              {savedCount} of {rows.length} pay run{rows.length === 1 ? "" : "s"} saved.
            </span>{" "}
            {allSaved ? "Share the payslips or start a new run." : "Tap save again to finish the rest."}
          </span>
        </div>
      )}

      {!allSaved &&
        (canApproveRun ? (
          <button
            onClick={() => handleSaveAll("approved")}
            disabled={saving || rows.length === 0}
            style={{ width: "100%", background: "#0369A1", border: "none", borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 700, cursor: saving ? "default" : "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 12px rgba(3,105,161,0.3)", opacity: saving ? 0.7 : 1 }}
          >
            ✔️ {saving ? `Saving ${savedCount + 1} of ${rows.length}...` : `Approve & Save ${rows.length > 1 ? `${rows.length} Pay Runs` : "Pay Run"}`}
          </button>
        ) : (
          <button
            onClick={() => handleSaveAll("prepared")}
            disabled={saving || rows.length === 0}
            style={{ width: "100%", background: "#fff", border: "2px solid #0C4A6E", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, cursor: saving ? "default" : "pointer", color: "#0C4A6E" }}
          >
            {saving ? "Saving..." : "Save as prepared — owner approves before wages go out"}
          </button>
        ))}

      {plan !== "solo" ? (
        <button
          onClick={async () => {
            if (!allSaved) await handleSaveAll(canApproveRun ? "approved" : "prepared");
            setShareOpen(true);
          }}
          disabled={saving}
          style={{ width: "100%", background: allSaved ? "#0C4A6E" : "#fff", border: "2px solid #0C4A6E", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, cursor: saving ? "default" : "pointer", color: allSaved ? "#fff" : "#0C4A6E", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
        >
          <span>📤</span> {allSaved ? (rows.length > 1 ? "Share Payslips" : "Share Payslip") : "Save & Share Payslips"}
        </button>
      ) : (
        <button
          onClick={() => setShowUpgrade(true)}
          style={{ width: "100%", background: "#f8fafc", border: "2px solid #e2e8f0", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, cursor: "pointer", color: "#94a3b8", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
        >
          🔒 Share Payslip — Business only
        </button>
      )}

      {allSaved && (
        <button onClick={onExit} style={{ width: "100%", background: "none", border: "none", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 8, padding: 8 }}>
          Done — back to pay runs
        </button>
      )}

      {showUpgrade && business && <UpgradeModal feature="payrun" currentPlan={plan} isOwner={member.role === "owner"} onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
