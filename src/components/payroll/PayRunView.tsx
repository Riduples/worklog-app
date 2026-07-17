"use client";

import { useState } from "react";
import Link from "next/link";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
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
import { fmt, todayStr } from "@/lib/format";
import { calcLeaveBalances, getLoanBalance } from "@/lib/payroll";
import { canApprove } from "@/lib/permissions";
import { isRestricted, TIERS, type Plan } from "@/lib/tiers";
import { useTaxRates } from "@/lib/taxRates";
import type { DocForRender } from "@/lib/docgen/buildDocumentHTML";
import { BackLink } from "@/components/ui/BackLink";

const STEP_LABELS = ["Employee", "Period", "Earnings", "Deductions", "Summary"];

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

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 16, padding: 0 }}>
      ← Back
    </button>
  );
}

export function PayRunView() {
  const { data: staff } = useStaffRegister();
  const { data: loans } = useWorkerLoans();
  const { data: leaveRecords } = useWorkerLeave();
  const { data: payRuns } = usePayRuns();
  const { data: business } = useBusinessProfile();
  const { data: currentMember } = useCurrentMember();
  const taxRates = useTaxRates();
  const createPayRun = useCreatePayRun();

  const [step, setStep] = useState(1);
  const [saved, setSaved] = useState(false);
  const [savedPayRunId, setSavedPayRunId] = useState<string | null>(null);
  const [showPayslip, setShowPayslip] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [error, setError] = useState("");

  const [staffId, setStaffId] = useState("");
  const [payPeriod, setPayPeriod] = useState<"Weekly" | "Fortnightly" | "Monthly">("Monthly");
  const [payDate, setPayDate] = useState(todayStr());
  const [unitsWorked, setUnitsWorked] = useState("");
  const [showOT, setShowOT] = useState(false);
  const [overtimeUnits, setOvertimeUnits] = useState("");
  const [overtimeRate, setOvertimeRate] = useState("1.5");
  const [showAllowance, setShowAllowance] = useState(false);
  const [allowances, setAllowances] = useState("");
  const [allowanceDesc, setAllowanceDesc] = useState("Allowance");
  const [loanDeduction, setLoanDeduction] = useState("");
  const [showOtherDed, setShowOtherDed] = useState(false);
  const [otherDeductions, setOtherDeductions] = useState("");
  const [otherDeductionDesc, setOtherDeductionDesc] = useState("Deduction");
  const [showLeave, setShowLeave] = useState(false);
  const [leaveDays, setLeaveDays] = useState("");
  const [leaveType, setLeaveType] = useState("Annual");

  const plan = (business?.plan ?? "shoebox") as Plan;
  const payRunRestriction = isRestricted(plan, "payrun");
  const member = currentMember ?? { role: "owner", permissions: {} };
  const canApproveRun = canApprove(member, "payrun");

  const selectedWorker = (staff ?? []).find((w) => w.id === staffId) ?? null;
  const staffLoans = (loans ?? []).filter((l) => l.staff_id === staffId);
  const loanBalance = getLoanBalance(staffLoans);
  const isContractor = selectedWorker?.is_contractor ?? false;
  const unitLabel = selectedWorker?.pay_type === "Hourly" ? "hours" : "days";
  const daysPerMonth = (selectedWorker?.days_per_week ?? 5) * 4.33;
  const baseRate = !selectedWorker
    ? 0
    : selectedWorker.pay_type === "Hourly"
      ? (selectedWorker.hourly_rate ?? 0)
      : selectedWorker.pay_type === "Monthly"
        ? (selectedWorker.monthly_salary ?? 0) / (daysPerMonth || 22)
        : (selectedWorker.daily_wage ?? 0);

  const suggestedUnits = (() => {
    if (!selectedWorker) return "";
    const dPW = selectedWorker.days_per_week ?? 5;
    if (payPeriod === "Weekly") return String(dPW);
    if (payPeriod === "Fortnightly") return String(dPW * 2);
    if (payPeriod === "Monthly") {
      return selectedWorker.pay_type === "Hourly" ? String(Math.round(daysPerMonth * (selectedWorker.hours_per_day ?? 8))) : String(Math.round(daysPerMonth));
    }
    return "";
  })();

  const units = parseFloat(unitsWorked || "0");
  const grossBase = baseRate * units;
  const overtimeAmt = parseFloat(overtimeUnits || "0") * baseRate * parseFloat(overtimeRate || "1.5");
  const allowancesAmt = parseFloat(allowances || "0");
  const grossWages = grossBase + overtimeAmt + allowancesAmt;
  const uifCalc = !isContractor ? taxRates.calcUIF(grossWages) : { employee: 0, employer: 0, total: 0 };
  // SDL is employer-only and applies once the business registers for it
  // (required over ~R500k annual payroll). Contractors are exempt.
  const sdl = !isContractor && business?.sdl_registered ? grossWages * taxRates.SDL_RATE : 0;
  const monthlyEquiv = payPeriod === "Weekly" ? grossWages * 4.33 : payPeriod === "Fortnightly" ? grossWages * 2.17 : grossWages;
  const paye = !isContractor ? taxRates.calcMonthlyPAYE(monthlyEquiv, "Monthly") : 0;
  const loanDeductionAmt = parseFloat(loanDeduction || "0");
  const otherDeductionsAmt = parseFloat(otherDeductions || "0");
  const leaveDaysAmt = parseFloat(leaveDays || "0");
  const netPay = grossWages - uifCalc.employee - paye - loanDeductionAmt - otherDeductionsAmt;

  const leaveEntries = [
    ...(leaveRecords ?? []).filter((l) => l.staff_id === staffId).map((l) => ({ leave_type: l.leave_type, days: l.days, date: l.start_date })),
    ...(payRuns ?? [])
      .filter((p) => p.staff_id === staffId && (p.leave_days ?? 0) > 0)
      .map((p) => ({ leave_type: p.leave_type ?? "Annual", days: p.leave_days ?? 0, date: p.pay_date })),
  ];
  const lb = selectedWorker && !isContractor ? calcLeaveBalances(selectedWorker.start_date, leaveEntries) : null;

  const pendingLeaveDays = (leaveRecords ?? [])
    .filter((l) => l.staff_id === staffId && l.start_date.startsWith(payDate.slice(0, 7)))
    .reduce((s, l) => s + l.days, 0);
  const pendingLeaveType = (leaveRecords ?? []).find((l) => l.staff_id === staffId && l.start_date.startsWith(payDate.slice(0, 7)))?.leave_type ?? "Annual";

  const reset = () => {
    setStep(1);
    setStaffId("");
    setPayPeriod("Monthly");
    setPayDate(todayStr());
    setUnitsWorked("");
    setShowOT(false);
    setOvertimeUnits("");
    setOvertimeRate("1.5");
    setShowAllowance(false);
    setAllowances("");
    setAllowanceDesc("Allowance");
    setLoanDeduction("");
    setShowOtherDed(false);
    setOtherDeductions("");
    setOtherDeductionDesc("Deduction");
    setShowLeave(false);
    setLeaveDays("");
    setLeaveType("Annual");
    setSaved(false);
    setSavedPayRunId(null);
    setShowPayslip(false);
    setError("");
  };

  const handleSave = (status: "prepared" | "approved") => {
    if (!selectedWorker) return;
    setError("");
    createPayRun.mutate(
      {
        staffId: selectedWorker.id,
        workerName: selectedWorker.full_name,
        payPeriod,
        payDate,
        unitsWorked: units,
        baseRate,
        overtimeAmount: overtimeAmt,
        allowancesAmount: allowancesAmt,
        grossWages,
        uifEmployee: uifCalc.employee,
        uifEmployer: uifCalc.employer,
        paye,
        sdl,
        loanDeducted: loanDeductionAmt,
        otherDeductions: otherDeductionsAmt,
        otherDeductionDesc: otherDeductionsAmt > 0 ? otherDeductionDesc : null,
        leaveDays: leaveDaysAmt,
        leaveType: leaveDaysAmt > 0 ? leaveType : null,
        netPay,
        status,
      },
      {
        onSuccess: (pr) => {
          setSaved(true);
          setSavedPayRunId(pr.id);
        },
        onError: (e) => setError(e instanceof Error ? e.message : "Couldn't save the pay run."),
      }
    );
  };

  const payslipDoc: DocForRender | null = selectedWorker
    ? {
        doc_number: `PAY-${payDate}-${selectedWorker.full_name.replace(/\s+/g, "").slice(0, 6).toUpperCase()}`,
        issue_date: payDate,
        recipient_name: selectedWorker.full_name,
        line_items: [
          { desc: `Basic pay — ${units} ${unitLabel} × ${fmt(baseRate)}`, labour: grossBase, materials: 0, qty: 1 },
          overtimeAmt > 0 ? { desc: `Overtime — ${overtimeUnits} hrs × ${overtimeRate}x rate`, labour: overtimeAmt, materials: 0, qty: 1 } : null,
          allowancesAmt > 0 ? { desc: allowanceDesc, labour: allowancesAmt, materials: 0, qty: 1 } : null,
          leaveDaysAmt > 0 ? { desc: `${leaveType} leave — ${leaveDaysAmt} day${leaveDaysAmt !== 1 ? "s" : ""}`, labour: 0, materials: 0, qty: leaveDaysAmt } : null,
          { desc: "UIF deduction (employee 1%)", labour: -uifCalc.employee, materials: 0, qty: 1 },
          paye > 0 ? { desc: "PAYE income tax", labour: -paye, materials: 0, qty: 1 } : null,
          loanDeductionAmt > 0 ? { desc: "Loan / advance repayment", labour: -loanDeductionAmt, materials: 0, qty: 1 } : null,
          otherDeductionsAmt > 0 ? { desc: otherDeductionDesc, labour: -otherDeductionsAmt, materials: 0, qty: 1 } : null,
        ].filter((i): i is NonNullable<typeof i> => i !== null),
        subtotal: netPay,
        vat_rate: null,
        vat_amount: 0,
        deposit: 0,
        balance_due: null,
        due_date: payDate,
        valid_until: null,
      }
    : null;

  const Header = () => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
      <div>
        <BackLink />
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Pay Run</h1>
      </div>
    </div>
  );

  // ── STEP 1: EMPLOYEE ──
  if (step === 1) {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <Header />
        <StepBar step={step} />
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 12 }}>Who are you paying?</div>
        {(staff ?? []).length === 0 ? (
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
          (staff ?? []).map((w) => {
            const lastWage = (payRuns ?? []).filter((p) => p.staff_id === w.id)[0];
            const loanBal = getLoanBalance((loans ?? []).filter((l) => l.staff_id === w.id));
            const rate = w.pay_type === "Hourly" ? `${fmt(w.hourly_rate ?? 0)}/hr` : w.pay_type === "Monthly" ? `${fmt(w.monthly_salary ?? 0)}/mo` : `${fmt(w.daily_wage ?? 0)}/day`;
            const isSelected = staffId === w.id;
            return (
              <button
                key={w.id}
                onClick={() => setStaffId(w.id)}
                style={{ width: "100%", background: isSelected ? "#F0F9FF" : "#fff", border: `2px solid ${isSelected ? "#0C4A6E" : "#e2e8f0"}`, borderRadius: 14, padding: "14px 16px", marginBottom: 8, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{w.full_name}</span>
                    {w.is_contractor && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: "#fff7ed", color: "#92400e", border: "1px solid #fed7aa" }}>🧾 Contractor</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    {rate}
                    {lastWage ? ` · Last paid ${lastWage.pay_date}` : " · Not paid yet"}
                    {w.is_contractor ? " · No UIF or PAYE" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  {loanBal > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#b45309", background: "#fff7ed", padding: "2px 8px", borderRadius: 8 }}>Loan {fmt(loanBal)}</span>}
                  {isSelected && <span style={{ fontSize: 14, color: "#0C4A6E" }}>✓</span>}
                </div>
              </button>
            );
          })
        )}
        <NextBtn label="Next → Period" disabled={!staffId} onClick={() => setStep(2)} />
      </div>
    );
  }

  // ── STEP 2: PERIOD ──
  if (step === 2) {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <Header />
        <StepBar step={step} />
        <BackBtn onClick={() => setStep(1)} />
        <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "11px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0C4A6E" }}>{selectedWorker?.full_name}</span>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>{selectedWorker?.pay_type}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 12 }}>Pay period</div>
        <Field label="Period type">
          <Chips options={["Weekly", "Fortnightly", "Monthly"]} selected={payPeriod} onSelect={(v) => v && setPayPeriod(v as typeof payPeriod)} />
        </Field>
        <Field label="Pay date">
          <Input type="date" value={payDate} onChange={setPayDate} />
        </Field>
        <NextBtn
          label="Next → Earnings"
          onClick={() => {
            if (!unitsWorked && suggestedUnits) setUnitsWorked(suggestedUnits);
            setStep(3);
          }}
        />
      </div>
    );
  }

  // ── STEP 3: EARNINGS ──
  if (step === 3) {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <Header />
        <StepBar step={step} />
        <BackBtn onClick={() => setStep(2)} />
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 12 }}>Earnings</div>
        <Field label={`${unitLabel === "hours" ? "Hours" : "Days"} worked`}>
          <Input type="number" value={unitsWorked} onChange={setUnitsWorked} placeholder={suggestedUnits || "0"} />
          {suggestedUnits && !unitsWorked && <div style={{ fontSize: 11, color: "#0369A1", marginTop: 3 }}>Suggested: {suggestedUnits} {unitLabel} for {payPeriod.toLowerCase()} period</div>}
        </Field>
        {grossBase > 0 && (
          <div style={{ background: "#F0F9FF", borderRadius: 10, padding: "9px 12px", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#0369A1" }}>Basic: {units} {unitLabel} × {fmt(baseRate)}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0C4A6E" }}>{fmt(grossBase)}</span>
          </div>
        )}

        <button onClick={() => setShowOT((p) => !p)} style={{ width: "100%", background: showOT ? "#F0F9FF" : "#f8fafc", border: `1.5px solid ${showOT ? "#BAE6FD" : "#e2e8f0"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", cursor: "pointer" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>+ Add overtime</span>
          <span style={{ color: "#94a3b8" }}>{showOT ? "▲" : "▼"}</span>
        </button>
        {showOT && (
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label={`OT ${unitLabel}`}>
                <Input type="number" value={overtimeUnits} onChange={setOvertimeUnits} placeholder="0" />
              </Field>
              <Field label="OT rate">
                <select value={overtimeRate} onChange={(e) => setOvertimeRate(e.target.value)} style={{ width: "100%", padding: "13px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, background: "#fff" }}>
                  <option value="1.5">1.5× (Standard OT)</option>
                  <option value="2">2× (Sunday / PH)</option>
                </select>
              </Field>
            </div>
          </div>
        )}

        <button onClick={() => setShowAllowance((p) => !p)} style={{ width: "100%", background: showAllowance ? "#F0F9FF" : "#f8fafc", border: `1.5px solid ${showAllowance ? "#BAE6FD" : "#e2e8f0"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", cursor: "pointer" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>+ Add allowance</span>
          <span style={{ color: "#94a3b8" }}>{showAllowance ? "▲" : "▼"}</span>
        </button>
        {showAllowance && (
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="Amount (R)">
                <Input type="number" value={allowances} onChange={setAllowances} placeholder="0" />
              </Field>
              <Field label="Description">
                <Input value={allowanceDesc} onChange={setAllowanceDesc} placeholder="Travel, Meal..." />
              </Field>
            </div>
          </div>
        )}

        {grossWages > 0 && (
          <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "12px 16px", marginTop: 4, marginBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#38BDF8", fontWeight: 700 }}>Gross wages</span>
              <span style={{ fontSize: 20, color: "#fff", fontWeight: 900 }}>{fmt(grossWages)}</span>
            </div>
          </div>
        )}
        <NextBtn label="Next → Deductions" disabled={!unitsWorked} onClick={() => setStep(4)} />
      </div>
    );
  }

  // ── STEP 4: DEDUCTIONS ──
  if (step === 4) {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <Header />
        <StepBar step={step} />
        <BackBtn onClick={() => setStep(3)} />
        <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "11px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0C4A6E" }}>{selectedWorker?.full_name} · Gross {fmt(grossWages)}</span>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>{payPeriod}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 4 }}>Deductions</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>Statutory deductions are auto-calculated. Add any extras below.</div>

        <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Statutory (auto-calculated)</div>
          {isContractor ? (
            <div style={{ fontSize: 12, color: "#92400e", fontWeight: 600, background: "#fff7ed", borderRadius: 8, padding: "8px 10px" }}>
              🧾 Independent contractor — no UIF, no PAYE deductions. They handle their own tax and UIF.
            </div>
          ) : (
            <>
              <Row label={`UIF (employee ${(taxRates.UIF_EMPLOYEE_RATE * 100).toFixed(0)}%)`} value={`−${fmt(uifCalc.employee)}`} />
              {paye > 0 ? (
                <Row label="PAYE" value={`−${fmt(paye)}`} bold />
              ) : (
                <div style={{ fontSize: 11, color: "#0369A1", marginTop: 4 }}>
                  {`✅ No PAYE — below ${fmt(taxRates.PAYE_MONTHLY_THRESHOLD)}/month threshold`}
                </div>
              )}
            </>
          )}
        </div>

        {loanBalance > 0 && (
          <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>💰 Outstanding advance: {fmt(loanBalance)}</div>
            <Field label="Deduct from this pay run (R)">
              <Input type="number" value={loanDeduction} onChange={setLoanDeduction} placeholder="0.00" />
            </Field>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button onClick={() => setLoanDeduction(String(Math.min(loanBalance, grossWages).toFixed(2)))} style={{ flex: 1, background: "#b45309", border: "none", borderRadius: 8, padding: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#fff" }}>
                Deduct all ({fmt(Math.min(loanBalance, grossWages))})
              </button>
              <button onClick={() => setLoanDeduction("")} style={{ flex: 1, background: "#f1f5f9", border: "none", borderRadius: 8, padding: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#64748b" }}>
                None this time
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            if (!showLeave && pendingLeaveDays > 0 && !leaveDays) {
              setLeaveDays(String(pendingLeaveDays));
              setLeaveType(pendingLeaveType);
            }
            setShowLeave((p) => !p);
          }}
          style={{ width: "100%", background: showLeave ? "#F0F9FF" : "#f8fafc", border: `1.5px solid ${showLeave ? "#BAE6FD" : "#e2e8f0"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", cursor: "pointer" }}
        >
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>🏖️ Leave taken this period?</span>
            {lb && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>Annual {lb.annualBalance}d · Sick {lb.sickBalance}d · Family {lb.familyBalance}d</div>}
            {pendingLeaveDays > 0 && !showLeave && <div style={{ fontSize: 11, color: "#b45309", marginTop: 1 }}>⚡ {pendingLeaveDays}d {pendingLeaveType} leave recorded this month — tap to include</div>}
          </div>
          <span style={{ color: "#94a3b8" }}>{showLeave ? "▲" : "▼"}</span>
        </button>
        {showLeave && (
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 8 }}>
            {pendingLeaveDays > 0 && (
              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "8px 10px", marginBottom: 8, fontSize: 12, color: "#92400e" }}>
                ⚡ {pendingLeaveDays}d {pendingLeaveType} leave was recorded in Leave tool this month
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="Leave type">
                <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, background: "#fff" }}>
                  <option value="Annual">Annual leave</option>
                  <option value="Sick">Sick leave</option>
                  <option value="Family">Family responsibility</option>
                  <option value="Unpaid">Unpaid leave</option>
                  <option value="Public Holiday">Public holiday</option>
                </select>
              </Field>
              <Field label="Days">
                <Input type="number" value={leaveDays} onChange={setLeaveDays} placeholder="0" />
              </Field>
            </div>
          </div>
        )}

        <button onClick={() => setShowOtherDed((p) => !p)} style={{ width: "100%", background: showOtherDed ? "#fff1f2" : "#f8fafc", border: `1.5px solid ${showOtherDed ? "#fecdd3" : "#e2e8f0"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", cursor: "pointer" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>− Other deduction</span>
          <span style={{ color: "#94a3b8" }}>{showOtherDed ? "▲" : "▼"}</span>
        </button>
        {showOtherDed && (
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="Amount (R)">
                <Input type="number" value={otherDeductions} onChange={setOtherDeductions} placeholder="0" />
              </Field>
              <Field label="Description">
                <Input value={otherDeductionDesc} onChange={setOtherDeductionDesc} placeholder="Uniform, Tools..." />
              </Field>
            </div>
          </div>
        )}

        <NextBtn label="Next → Summary" onClick={() => setStep(5)} />
      </div>
    );
  }

  // ── STEP 5: SUMMARY ──
  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <Header />
      <StepBar step={step} />
      <BackBtn onClick={() => setStep(4)} />

      <div style={{ background: "#0C4A6E", borderRadius: 16, padding: "18px 20px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Payslip preview</div>
        <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", marginBottom: 2 }}>{selectedWorker?.full_name}</div>
        <div style={{ fontSize: 12, color: "#7DD3FC", marginBottom: 12 }}>{payPeriod} · {payDate}</div>
        <Row label={`Basic (${units} ${unitLabel} × ${fmt(baseRate)})`} value={fmt(grossBase)} />
        {overtimeAmt > 0 && <Row label={`Overtime (${overtimeUnits} × ${overtimeRate}x)`} value={fmt(overtimeAmt)} />}
        {allowancesAmt > 0 && <Row label={allowanceDesc} value={fmt(allowancesAmt)} />}
        <Row label="Gross wages" value={fmt(grossWages)} bold />
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", marginTop: 8, paddingTop: 8 }}>
          <Row label="UIF (employee 1%)" value={`−${fmt(uifCalc.employee)}`} />
          {paye > 0 && <Row label="PAYE" value={`−${fmt(paye)}`} />}
          {loanDeductionAmt > 0 && <Row label="Loan repayment" value={`−${fmt(loanDeductionAmt)}`} />}
          {otherDeductionsAmt > 0 && <Row label={otherDeductionDesc} value={`−${fmt(otherDeductionsAmt)}`} />}
          {leaveDaysAmt > 0 && <Row label={`${leaveType} leave (${leaveDaysAmt}d)`} value="noted" />}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, color: "#38BDF8", fontWeight: 700 }}>NET PAY (take-home)</span>
          <span style={{ fontSize: 26, color: "#fff", fontWeight: 900 }}>{fmt(netPay)}</span>
        </div>
      </div>

      <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "11px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Your cost to SARS — pay by 7th</div>
        <Row label="UIF employer (1%)" value={fmt(uifCalc.employer)} />
        {sdl > 0 && <Row label="SDL (1%)" value={fmt(sdl)} />}
        <Row label="Total" value={fmt(uifCalc.total + sdl)} bold />
      </div>

      {payRunRestriction && (
        <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 10, padding: "9px 12px", marginBottom: 10, fontSize: 12, color: "#92400e" }}>
          <span style={{ fontWeight: 700 }}>{TIERS[plan].label} plan</span> — {payRunRestriction.message}
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 10 }}>{error}</p>}

      {saved && (
        <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 10, padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#0369A1" }}>
          <span style={{ fontSize: 16 }}>✅</span>
          <span>
            <span style={{ fontWeight: 700 }}>Pay run saved.</span> Share the payslip or start a new run.
          </span>
        </div>
      )}

      {!saved &&
        (canApproveRun ? (
          <button
            onClick={() => handleSave("approved")}
            disabled={createPayRun.isPending}
            style={{ width: "100%", background: "#0369A1", border: "none", borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 700, cursor: createPayRun.isPending ? "default" : "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 12px rgba(3,105,161,0.3)" }}
          >
            ✔️ {createPayRun.isPending ? "Saving..." : "Approve & Save Pay Run"}
          </button>
        ) : (
          <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "12px 16px", textAlign: "center", fontSize: 13, color: "#0369A1", fontWeight: 600 }}>
            ✔️ Prepared — waiting for owner approval before wages are released
          </div>
        ))}

      {plan === "business" ? (
        <button
          onClick={() => {
            if (!saved) handleSave(canApproveRun ? "approved" : "prepared");
            setShowPayslip(true);
          }}
          style={{ width: "100%", background: saved ? "#0C4A6E" : "#fff", border: "2px solid #0C4A6E", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, cursor: "pointer", color: saved ? "#fff" : "#0C4A6E", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
        >
          <span>📤</span> {saved ? "Share Payslip" : "Save & Share Payslip"}
        </button>
      ) : (
        <button
          onClick={() => setShowUpgrade(true)}
          style={{ width: "100%", background: "#f8fafc", border: "2px solid #e2e8f0", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, cursor: "pointer", color: "#94a3b8", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
        >
          🔒 Share Payslip — Business only
        </button>
      )}

      {saved && (
        <button onClick={reset} style={{ width: "100%", background: "none", border: "none", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 8, padding: 8 }}>
          Done — start a new pay run
        </button>
      )}

      {showPayslip && payslipDoc && savedPayRunId && (
        <div style={{ marginTop: 16, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 4 }}>Payslip ready</div>
          <DocumentActions
            doc={payslipDoc}
            kind="payslip"
            sourceId={savedPayRunId}
            shareText={`Payslip for ${selectedWorker?.full_name} — ${payPeriod} ${payDate}. Net pay: ${fmt(netPay)}.`}
          />
        </div>
      )}

      {showUpgrade && business && (
        <UpgradeModal feature="payrun" currentPlan={plan} businessId={business.id} isOwner={member.role === "owner"} onClose={() => setShowUpgrade(false)} />
      )}
    </div>
  );
}
