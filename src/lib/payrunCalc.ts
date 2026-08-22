// Pay-run arithmetic, kept out of the wizard so every figure a payslip shows can
// be tested without rendering React — and so the wizard can SHOW its working.
//
// Two rules run through all of it:
//
//  1. Nothing is a black box. Every derived number (days worked, overtime, the
//     daily rate a monthly salary is prorated at) comes back with the lines that
//     produced it, so the wizard can print the sum next to the field and the user
//     can see why it says 18 days and not 22. Every one of them stays editable —
//     these are suggestions with their reasoning attached, not locks.
//
//  2. Unpaid leave is taken off the DAYS, never off the net pay afterwards. The
//     older wizard paid a full month's gross and then subtracted the unpaid days
//     from the net, which quietly overstated the wage expense on the books and
//     charged the employee UIF and PAYE on money they never earned. Fewer days ⇒
//     lower gross ⇒ correct UIF/PAYE/SDL and a correct expense.
import { addDays, toLocalIsoDate } from "@/lib/format";

export type PayPeriod = "Weekly" | "Fortnightly" | "Monthly";
export type OvertimeBasis = "hours" | "days";

// A single line of shown working. `kind` only drives colour/prefix in the UI.
export type CalcLine = { label: string; value: string; kind?: "base" | "minus" | "plus" | "total" | "note" };

const pad = (n: number) => String(n).padStart(2, "0");

// Parse YYYY-MM-DD as a LOCAL calendar day. `new Date("2025-08-01")` is parsed as
// UTC midnight, which is the previous day in SAST — the same trap toLocalIsoDate
// exists to avoid. Splitting the parts sidesteps it.
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

// Trim a computed day count to something a human would write: 21, 20.5, 17.25.
export const roundDays = (n: number) => Math.round(n * 100) / 100;

/**
 * The period a pay date belongs to, as a default the user can then edit.
 *
 * Monthly runs cover the calendar month the pay date falls in — the month is what
 * a salary is quoted for and what SARS files on. Weekly/fortnightly runs cover the
 * 7/14 days ending on the pay date, which is how a wage week is actually worked.
 */
export function periodForPayDate(payDate: string, payPeriod: PayPeriod): { start: string; end: string } {
  if (!payDate) return { start: "", end: "" };
  if (payPeriod === "Monthly") {
    const [y, m] = payDate.split("-").map(Number);
    // Day 0 of the next month is the last day of this one.
    return { start: `${y}-${pad(m)}-01`, end: toLocalIsoDate(new Date(y, m, 0)) };
  }
  return { start: addDays(payDate, payPeriod === "Weekly" ? -6 : -13), end: payDate };
}

/** Does this weekday count as a working day for someone on `daysPerWeek` days? */
export function isWorkingDay(date: Date, daysPerWeek: number): boolean {
  const dow = date.getDay(); // 0 = Sunday
  if (daysPerWeek >= 7) return true;
  if (daysPerWeek >= 6) return dow !== 0; // Mon–Sat
  return dow >= 1 && dow <= 5; // Mon–Fri
}

/** Working days in an inclusive date range. Empty/reversed ranges are 0. */
export function countWorkingDays(start: string, end: string, daysPerWeek: number): number {
  if (!start || !end || end < start) return 0;
  const last = parseLocalDate(end);
  let count = 0;
  for (let d = parseLocalDate(start); d <= last; d.setDate(d.getDate() + 1)) {
    if (isWorkingDay(d, daysPerWeek)) count++;
  }
  return count;
}

/** Inclusive calendar days in a range. */
export function countCalendarDays(start: string, end: string): number {
  if (!start || !end || end < start) return 0;
  const ms = parseLocalDate(end).getTime() - parseLocalDate(start).getTime();
  return Math.round(ms / 86400000) + 1;
}

export type LeaveRecordLike = { leave_type: string; days: number; start_date: string; end_date?: string | null };
export type LeaveInPeriod = {
  paidDays: number;
  unpaidDays: number;
  /** Paid days per type, e.g. { Annual: 3, Sick: 1 } — for the shown working. */
  paidByType: Record<string, number>;
  entries: Array<{ leave_type: string; days: number; start_date: string; end_date: string | null; countedDays: number }>;
};

/**
 * The leave already recorded in the Leave tool that falls inside this pay period,
 * split into what still gets paid and what doesn't.
 *
 * A record that straddles the period boundary is counted by the share of its
 * calendar span that lands inside — 6 days over month-end, 3 in, gives 3.
 */
export function leaveInPeriod(records: LeaveRecordLike[], start: string, end: string): LeaveInPeriod {
  const out: LeaveInPeriod = { paidDays: 0, unpaidDays: 0, paidByType: {}, entries: [] };
  if (!start || !end) return out;
  for (const r of records) {
    const rStart = r.start_date;
    const rEnd = r.end_date || r.start_date;
    if (!rStart || rStart > end || rEnd < start) continue;
    const span = countCalendarDays(rStart, rEnd) || 1;
    const overlap = countCalendarDays(rStart > start ? rStart : start, rEnd < end ? rEnd : end);
    const counted = roundDays((Number(r.days) || 0) * (overlap / span));
    if (counted <= 0) continue;
    out.entries.push({ leave_type: r.leave_type, days: Number(r.days) || 0, start_date: rStart, end_date: r.end_date ?? null, countedDays: counted });
    if (r.leave_type === "Unpaid") {
      out.unpaidDays = roundDays(out.unpaidDays + counted);
    } else {
      out.paidDays = roundDays(out.paidDays + counted);
      out.paidByType[r.leave_type] = roundDays((out.paidByType[r.leave_type] ?? 0) + counted);
    }
  }
  return out;
}

export type DaysWorkedInput = {
  periodStart: string;
  periodEnd: string;
  daysPerWeek: number;
  hoursPerDay: number;
  /** "Hourly" makes the field hours; anything else keeps it days. */
  payType: string;
  /** Employment start — a mid-period joiner is only paid from here. */
  employmentStart?: string | null;
  /** Last day worked — a leaver is only paid to here. */
  employmentEnd?: string | null;
  paidLeaveDays?: number;
  unpaidLeaveDays?: number;
};

export type DaysWorkedCalc = {
  /** The stretch actually paid for, after clipping to the employment dates. */
  from: string;
  to: string;
  proratedStart: boolean;
  proratedEnd: boolean;
  /** Working days in the FULL period — the base a monthly salary is divided by. */
  fullPeriodDays: number;
  /** Working days in the clipped stretch. */
  scheduledDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  /** Days paid at the normal rate: scheduled, less unpaid leave. */
  daysPaid: number;
  /** What goes in the field — hours for hourly staff, days for everyone else. */
  units: number;
  unitLabel: "days" | "hours";
  lines: CalcLine[];
};

/**
 * How many days (or hours) this person is paid for this period, with its working.
 *
 * Prorates both ends of employment, keeps paid leave paid, and drops unpaid leave
 * out of the days rather than off the net (see the note at the top of the file).
 */
export function calcDaysWorked(input: DaysWorkedInput): DaysWorkedCalc {
  const daysPerWeek = input.daysPerWeek > 0 ? input.daysPerWeek : 5;
  const hoursPerDay = input.hoursPerDay > 0 ? input.hoursPerDay : 8;
  const isHourly = input.payType === "Hourly";
  const paidLeaveDays = roundDays(Math.max(0, input.paidLeaveDays ?? 0));

  const empStart = input.employmentStart || null;
  const empEnd = input.employmentEnd || null;
  const from = empStart && empStart > input.periodStart ? empStart : input.periodStart;
  const to = empEnd && empEnd < input.periodEnd ? empEnd : input.periodEnd;
  const proratedStart = !!empStart && empStart > input.periodStart && empStart <= input.periodEnd;
  const proratedEnd = !!empEnd && empEnd < input.periodEnd && empEnd >= input.periodStart;

  const fullPeriodDays = countWorkingDays(input.periodStart, input.periodEnd, daysPerWeek);
  const scheduledDays = countWorkingDays(from, to, daysPerWeek);
  // Never take off more unpaid leave than there are days to take it off.
  const unpaidLeaveDays = roundDays(Math.min(Math.max(0, input.unpaidLeaveDays ?? 0), scheduledDays));
  const daysPaid = roundDays(Math.max(0, scheduledDays - unpaidLeaveDays));
  const units = isHourly ? round2(daysPaid * hoursPerDay) : daysPaid;

  const dayWord = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  const lines: CalcLine[] = [
    {
      label: `Period ${input.periodStart} → ${input.periodEnd}`,
      value: `${countCalendarDays(input.periodStart, input.periodEnd)} calendar days`,
      kind: "note",
    },
  ];
  if (proratedStart || proratedEnd) {
    lines.push({
      label: proratedStart && proratedEnd ? `Employed ${from} → ${to}` : proratedStart ? `Started ${from} — paid from then` : `Last day ${to} — paid to then`,
      value: `${countCalendarDays(from, to)} calendar days`,
      kind: "note",
    });
  }
  lines.push({
    label: `Working days at ${daysPerWeek} day${daysPerWeek === 1 ? "" : "s"}/week`,
    value: dayWord(scheduledDays),
    kind: "base",
  });
  if (paidLeaveDays > 0) {
    lines.push({ label: "Paid leave in this period — stays paid", value: `${dayWord(paidLeaveDays)} · no change`, kind: "note" });
  }
  if (unpaidLeaveDays > 0) {
    lines.push({ label: "Less unpaid leave", value: `− ${dayWord(unpaidLeaveDays)}`, kind: "minus" });
  }
  lines.push({ label: isHourly ? "Days paid" : "Days paid", value: dayWord(daysPaid), kind: isHourly ? "base" : "total" });
  if (isHourly) {
    lines.push({ label: `× ${hoursPerDay} hours a day`, value: `${round2(units)} hours`, kind: "total" });
  }

  return {
    from,
    to,
    proratedStart,
    proratedEnd,
    fullPeriodDays,
    scheduledDays,
    paidLeaveDays,
    unpaidLeaveDays,
    daysPaid,
    units,
    unitLabel: isHourly ? "hours" : "days",
    lines,
  };
}

export type WorkerRates = {
  /** Rate per unit of the "units worked" field — per hour if hourly, else per day. */
  unitRate: number;
  dailyRate: number;
  hourlyRate: number;
  unitLabel: "days" | "hours";
  hoursPerDay: number;
  daysPerWeek: number;
  lines: CalcLine[];
};

export type RateWorker = {
  pay_type: string;
  daily_wage?: number | null;
  hourly_rate?: number | null;
  monthly_salary?: number | null;
  days_per_week?: number | null;
  hours_per_day?: number | null;
};

/**
 * The rates a run is priced at, and where they came from.
 *
 * A monthly salary is divided by the WORKING DAYS IN THIS PERIOD, not by a
 * 4.33-week average. Dividing by the average made a full month pay a little more
 * or less than the salary depending on how the weekdays fell (August's 21 working
 * days × salary/21.65 short-changed the employee by ~3%); dividing by the period's
 * own days makes a full month come to exactly the salary and a half month to
 * exactly half. `periodWorkingDays` of 0 (a weekly run, say) falls back to the
 * average so the rate is never divided by zero.
 */
export function workerRates(worker: RateWorker, periodWorkingDays: number): WorkerRates {
  const daysPerWeek = worker.days_per_week && worker.days_per_week > 0 ? worker.days_per_week : 5;
  const hoursPerDay = worker.hours_per_day && worker.hours_per_day > 0 ? worker.hours_per_day : 8;
  const lines: CalcLine[] = [];
  let dailyRate = 0;
  let hourlyRate = 0;

  if (worker.pay_type === "Hourly") {
    hourlyRate = worker.hourly_rate ?? 0;
    dailyRate = round2(hourlyRate * hoursPerDay);
    lines.push({ label: "Hourly rate (from their setup)", value: money(hourlyRate) + "/hour", kind: "base" });
    lines.push({ label: `× ${hoursPerDay} hours a day`, value: money(dailyRate) + "/day", kind: "note" });
  } else if (worker.pay_type === "Monthly") {
    const salary = worker.monthly_salary ?? 0;
    const divisor = periodWorkingDays > 0 ? periodWorkingDays : round2(daysPerWeek * 4.33);
    dailyRate = divisor > 0 ? round2(salary / divisor) : 0;
    hourlyRate = round2(dailyRate / hoursPerDay);
    lines.push({ label: "Monthly salary (from their setup)", value: money(salary) + "/month", kind: "base" });
    lines.push({
      label: periodWorkingDays > 0 ? `÷ ${divisor} working days this period` : `÷ ${divisor} average working days a month`,
      value: money(dailyRate) + "/day",
      kind: "note",
    });
  } else {
    dailyRate = worker.daily_wage ?? 0;
    hourlyRate = round2(dailyRate / hoursPerDay);
    lines.push({ label: "Daily wage (from their setup)", value: money(dailyRate) + "/day", kind: "base" });
    lines.push({ label: `÷ ${hoursPerDay} hours a day`, value: money(hourlyRate) + "/hour", kind: "note" });
  }

  const isHourly = worker.pay_type === "Hourly";
  return {
    unitRate: isHourly ? hourlyRate : dailyRate,
    dailyRate,
    hourlyRate,
    unitLabel: isHourly ? "hours" : "days",
    hoursPerDay,
    daysPerWeek,
    lines,
  };
}

// Local money formatting for calc labels. `fmt` from lib/format is the app-wide
// one; this keeps payrunCalc free of any import cycle with the UI helpers.
function money(n: number): string {
  return `R ${Number(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type OvertimeInput = {
  units: number;
  /** Hours is the BCEA's own unit; days is here for wage crews who count shifts. */
  basis: OvertimeBasis;
  multiplier: number;
  dailyRate: number;
  hourlyRate: number;
};

export type OvertimeCalc = { amount: number; rate: number; unitLabel: string; explain: string; lines: CalcLine[] };

/**
 * Overtime, whether the user counts it in hours or in whole days.
 *
 * Hours are priced off the hourly rate — derived from the daily wage ÷ hours a day
 * for staff who aren't on an hourly rate, which is exactly how the BCEA says to
 * work out a wage employee's hourly rate. Days are priced off the daily rate.
 */
export function calcOvertime(input: OvertimeInput): OvertimeCalc {
  const units = Number.isFinite(input.units) ? Math.max(0, input.units) : 0;
  const multiplier = input.multiplier > 0 ? input.multiplier : 1.5;
  const rate = input.basis === "hours" ? input.hourlyRate : input.dailyRate;
  const amount = round2(units * rate * multiplier);
  const unitLabel = input.basis === "hours" ? (units === 1 ? "hour" : "hours") : units === 1 ? "day" : "days";
  return {
    amount,
    rate,
    unitLabel,
    explain: `${units} ${unitLabel} × ${money(rate)}/${input.basis === "hours" ? "hour" : "day"} × ${multiplier} = ${money(amount)}`,
    lines: [
      { label: `${units} ${unitLabel} worked`, value: `${units}`, kind: "base" },
      { label: `× ${input.basis === "hours" ? "hourly" : "daily"} rate`, value: `${money(rate)}`, kind: "note" },
      { label: `× ${multiplier} (${multiplier === 2 ? "Sunday / public holiday" : "standard overtime"})`, value: `${multiplier}×`, kind: "note" },
      { label: "Overtime pay", value: money(amount), kind: "total" },
    ],
  };
}

export type RunMoneyInput = {
  unitRate: number;
  units: number;
  overtimeAmount: number;
  allowanceAmount: number;
  isContractor: boolean;
  sdlRegistered: boolean;
  sdlRate: number;
  payPeriod: PayPeriod;
  loanDeduction: number;
  otherDeduction: number;
  calcUIF: (gross: number) => { employee: number; employer: number; total: number };
  calcPAYE: (monthlyEquivalent: number, payPeriod: PayPeriod) => number;
};

export type RunMoney = {
  basic: number;
  overtime: number;
  allowance: number;
  gross: number;
  monthlyEquivalent: number;
  uifEmployee: number;
  uifEmployer: number;
  paye: number;
  sdl: number;
  loanDeduction: number;
  otherDeduction: number;
  totalDeductions: number;
  net: number;
  employerCost: number;
};

/**
 * Gross → deductions → net for one employee's run.
 *
 * PAYE is worked out on the annualised (monthly-equivalent) gross and scaled back
 * to this period, so a weekly run deducts a week's PAYE rather than a month's.
 * Contractors get neither UIF, PAYE nor SDL — they settle their own.
 */
export function calcRunMoney(i: RunMoneyInput): RunMoney {
  const basic = round2(i.unitRate * i.units);
  const overtime = round2(Math.max(0, i.overtimeAmount));
  const allowance = round2(Math.max(0, i.allowanceAmount));
  const gross = round2(basic + overtime + allowance);
  const monthlyEquivalent = round2(i.payPeriod === "Weekly" ? gross * 4.33 : i.payPeriod === "Fortnightly" ? gross * 2.17 : gross);
  const uif = i.isContractor ? { employee: 0, employer: 0, total: 0 } : i.calcUIF(gross);
  const paye = i.isContractor ? 0 : round2(i.calcPAYE(monthlyEquivalent, i.payPeriod));
  const sdl = !i.isContractor && i.sdlRegistered ? round2(gross * i.sdlRate) : 0;
  const loanDeduction = round2(Math.max(0, i.loanDeduction));
  const otherDeduction = round2(Math.max(0, i.otherDeduction));
  const totalDeductions = round2(uif.employee + paye + loanDeduction + otherDeduction);
  return {
    basic,
    overtime,
    allowance,
    gross,
    monthlyEquivalent,
    uifEmployee: round2(uif.employee),
    uifEmployer: round2(uif.employer),
    paye,
    sdl,
    loanDeduction,
    otherDeduction,
    totalDeductions,
    net: round2(gross - totalDeductions),
    employerCost: round2(uif.employer + sdl),
  };
}
