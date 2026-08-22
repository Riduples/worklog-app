// One employee's line in a pay run: what the user can change (the draft) and
// everything derived from it (the computed run).
//
// A pay run now covers as many employees as you tick, so the wizard holds a draft
// per person and computes each one the same way. Keeping that here rather than in
// the component means the whole payslip — days, overtime, gross, every deduction
// and the net — can be asserted in a test, and the wizard is left to lay it out.
import {
  calcDaysWorked,
  calcOvertime,
  calcRunMoney,
  leaveInPeriod,
  round2,
  workerRates,
  type CalcLine,
  type DaysWorkedCalc,
  type LeaveInPeriod,
  type LeaveRecordLike,
  type OvertimeBasis,
  type OvertimeCalc,
  type PayPeriod,
  type RunMoney,
  type WorkerRates,
} from "@/lib/payrunCalc";

/** Structural — `StaffMember` satisfies it, and a test can build one by hand. */
export type RunWorker = {
  id: string;
  full_name: string;
  pay_type: string;
  is_contractor: boolean;
  daily_wage?: number | null;
  hourly_rate?: number | null;
  monthly_salary?: number | null;
  days_per_week?: number | null;
  hours_per_day?: number | null;
  start_date?: string | null;
  terminated?: boolean;
  term_end_date?: string | null;
  recurring_allowance?: number | null;
  recurring_allowance_desc?: string | null;
};

/**
 * Everything the user can type for one employee.
 *
 * The `*Input` fields are all "" when the auto-calculated figure stands, and hold
 * the typed value once they override it. That's what lets the wizard keep
 * recalculating a suggestion as the period changes, then stop the moment someone
 * decides the suggestion is wrong — without ever losing the sum it worked out,
 * which stays on screen next to the field for comparison.
 */
export type Draft = {
  unitsInput: string;
  otUnits: string;
  otBasis: OvertimeBasis;
  otMultiplier: string;
  otAmountInput: string;
  showOT: boolean;
  allowance: string;
  allowanceDesc: string;
  showAllowance: boolean;
  loanDeduction: string;
  otherDeduction: string;
  otherDeductionDesc: string;
  showOtherDed: boolean;
  /** Leave NOT already captured in the Leave tool — this run records it there. */
  extraLeaveDays: string;
  extraLeaveType: string;
  showLeave: boolean;
};

export const EMPTY_DRAFT: Draft = {
  unitsInput: "",
  otUnits: "",
  otBasis: "hours",
  otMultiplier: "1.5",
  otAmountInput: "",
  showOT: false,
  allowance: "",
  allowanceDesc: "",
  showAllowance: false,
  loanDeduction: "",
  otherDeduction: "",
  otherDeductionDesc: "Deduction",
  showOtherDed: false,
  extraLeaveDays: "",
  extraLeaveType: "Annual",
  showLeave: false,
};

export type LoanLike = { loan_type: string; amount: number; repay_per_run?: number | null };

/** What an advance balance comes to: what was taken out, less what's been repaid. */
export function loanBalanceOf(loans: LoanLike[]): number {
  const advances = loans.filter((l) => l.loan_type === "advance").reduce((s, l) => s + Number(l.amount || 0), 0);
  const repayments = loans.filter((l) => l.loan_type === "repayment").reduce((s, l) => s + Number(l.amount || 0), 0);
  return round2(Math.max(0, advances - repayments));
}

/**
 * A fresh draft with this person's standing setup pulled in — their monthly
 * allowance and the repayment they agreed on their advance. Both stay editable
 * for this run without touching their setup.
 */
export function draftForWorker(worker: RunWorker, loans: LoanLike[]): Draft {
  const allowance = Number(worker.recurring_allowance ?? 0);
  const balance = loanBalanceOf(loans);
  const agreed = loans.find((l) => l.loan_type === "advance" && l.repay_per_run != null);
  const repay = agreed && balance > 0 ? Math.min(Number(agreed.repay_per_run), balance) : null;
  return {
    ...EMPTY_DRAFT,
    showAllowance: allowance > 0,
    allowance: allowance > 0 ? String(allowance) : "",
    allowanceDesc: worker.recurring_allowance_desc ?? "Allowance",
    loanDeduction: repay != null ? String(repay) : "",
  };
}

const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

export type ComputeRunInput = {
  worker: RunWorker;
  draft: Draft;
  periodStart: string;
  periodEnd: string;
  payPeriod: PayPeriod;
  /** This worker's rows from the Leave tool — already-recorded leave. */
  leaveRecords: LeaveRecordLike[];
  loanBalance: number;
  sdlRegistered: boolean;
  sdlRate: number;
  calcUIF: (gross: number) => { employee: number; employer: number; total: number };
  calcPAYE: (monthlyEquivalent: number, payPeriod: PayPeriod) => number;
};

export type ComputedRun = {
  worker: RunWorker;
  draft: Draft;
  rates: WorkerRates;
  days: DaysWorkedCalc;
  overtime: OvertimeCalc;
  money: RunMoney;
  /** Leave found in the Leave tool for this period — shown, never re-recorded. */
  registerLeave: LeaveInPeriod;
  /** Extra leave typed on this run — this is what gets written to the register. */
  extraPaidLeaveDays: number;
  extraUnpaidLeaveDays: number;
  unpaidLeaveDays: number;
  /** What the unpaid days cost them, for the record. Already off the days above. */
  unpaidLeaveValue: number;
  units: number;
  unitsAreAuto: boolean;
  overtimeAmount: number;
  overtimeIsAuto: boolean;
  loanBalance: number;
  loanBalanceAfter: number;
  /** The basic-pay line, spelled out: "19 days × R 1 190.48 = R 22 619.12". */
  basicExplain: string;
  earningsLines: CalcLine[];
};

/** Turn one employee's draft into every figure their payslip needs. */
export function computeRun(i: ComputeRunInput): ComputedRun {
  const w = i.worker;
  const daysPerWeek = w.days_per_week && w.days_per_week > 0 ? w.days_per_week : 5;
  const hoursPerDay = w.hours_per_day && w.hours_per_day > 0 ? w.hours_per_day : 8;

  const registerLeave = leaveInPeriod(i.leaveRecords, i.periodStart, i.periodEnd);
  const extraDays = Math.max(0, num(i.draft.extraLeaveDays));
  const extraUnpaidLeaveDays = i.draft.extraLeaveType === "Unpaid" ? extraDays : 0;
  const extraPaidLeaveDays = i.draft.extraLeaveType === "Unpaid" ? 0 : extraDays;

  const days = calcDaysWorked({
    periodStart: i.periodStart,
    periodEnd: i.periodEnd,
    daysPerWeek,
    hoursPerDay,
    payType: w.pay_type,
    employmentStart: w.start_date ?? null,
    // Only a terminated employee stops being paid mid-period. A term_end_date on
    // someone still employed is a planned last day, not a reason to short-pay them.
    employmentEnd: w.terminated ? w.term_end_date ?? null : null,
    paidLeaveDays: registerLeave.paidDays + extraPaidLeaveDays,
    unpaidLeaveDays: registerLeave.unpaidDays + extraUnpaidLeaveDays,
  });

  const rates = workerRates(w, days.fullPeriodDays);

  const unitsAreAuto = i.draft.unitsInput.trim() === "";
  const units = unitsAreAuto ? days.units : Math.max(0, num(i.draft.unitsInput));

  const overtime = calcOvertime({
    units: num(i.draft.otUnits),
    basis: i.draft.otBasis,
    multiplier: num(i.draft.otMultiplier) || 1.5,
    dailyRate: rates.dailyRate,
    hourlyRate: rates.hourlyRate,
  });
  const overtimeIsAuto = i.draft.otAmountInput.trim() === "";
  const overtimeAmount = overtimeIsAuto ? overtime.amount : Math.max(0, num(i.draft.otAmountInput));

  const loanDeduction = Math.min(Math.max(0, num(i.draft.loanDeduction)), i.loanBalance);
  const money = calcRunMoney({
    unitRate: rates.unitRate,
    units,
    overtimeAmount,
    allowanceAmount: num(i.draft.allowance),
    isContractor: w.is_contractor,
    sdlRegistered: i.sdlRegistered,
    sdlRate: i.sdlRate,
    payPeriod: i.payPeriod,
    loanDeduction,
    otherDeduction: num(i.draft.otherDeduction),
    calcUIF: i.calcUIF,
    calcPAYE: i.calcPAYE,
  });

  const unitWord = rates.unitLabel === "hours" ? (units === 1 ? "hour" : "hours") : units === 1 ? "day" : "days";
  const basicExplain = `${units} ${unitWord} × ${fmtR(rates.unitRate)} = ${fmtR(money.basic)}`;

  const earningsLines: CalcLine[] = [
    { label: `Basic — ${basicExplain.split(" = ")[0]}`, value: fmtR(money.basic), kind: "base" },
    ...(money.overtime > 0 ? [{ label: overtimeIsAuto ? `Overtime — ${i.draft.otUnits || 0} ${i.draft.otBasis} × ${i.draft.otMultiplier}×` : "Overtime (entered)", value: fmtR(money.overtime), kind: "plus" as const }] : []),
    ...(money.allowance > 0 ? [{ label: i.draft.allowanceDesc || "Allowance", value: fmtR(money.allowance), kind: "plus" as const }] : []),
    { label: "Gross wages", value: fmtR(money.gross), kind: "total" },
  ];

  const unpaidLeaveDays = days.unpaidLeaveDays;
  return {
    worker: w,
    draft: i.draft,
    rates,
    days,
    overtime,
    money,
    registerLeave,
    extraPaidLeaveDays,
    extraUnpaidLeaveDays,
    unpaidLeaveDays,
    unpaidLeaveValue: round2(unpaidLeaveDays * rates.dailyRate),
    units,
    unitsAreAuto,
    overtimeAmount,
    overtimeIsAuto,
    loanBalance: i.loanBalance,
    loanBalanceAfter: round2(Math.max(0, i.loanBalance - loanDeduction)),
    basicExplain,
    earningsLines,
  };
}

function fmtR(n: number): string {
  return `R ${Number(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
