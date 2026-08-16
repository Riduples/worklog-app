// The three Payroll Reports, rolled up.
//
// Same shape as jobHours.ts: pure functions the report renders and the PDF
// prints, so the screen and the printed copy can never disagree, and the
// arithmetic is unit-tested rather than tangled into JSX.

import type { StaffMember } from "@/lib/supabase/hooks/useStaffRegister";
import type { WorkerLoan } from "@/lib/supabase/hooks/useWorkerLoans";
import type { WorkerLeaveRecord } from "@/lib/supabase/hooks/useWorkerLeave";
import { calcLeaveBalances, type LeaveBalances } from "@/lib/payroll";
import { monthlyRemunerationOf, monthsEmployedFrom } from "@/lib/eti";

export const EMPLOYMENT_LABEL: Record<string, string> = {
  permanent: "Permanent",
  fixed_term: "Fixed-term",
  casual: "Casual",
  contractor: "Contractor",
};

// ── Staff register ───────────────────────────────────────────────────────────

export type StaffReportRow = {
  id: string;
  name: string;
  employeeNumber: string;
  employmentType: string;
  isContractor: boolean;
  payType: string;
  rate: number;
  daysPerWeek: number;
  hoursPerDay: number;
  startDate: string;
  monthsEmployed: number;
  /** Estimated cost per month from the pay type and rate, plus any standing allowance. */
  monthlyCost: number;
  contractEndDate: string;
  terminated: boolean;
  termEndDate: string;
  termReason: string;
};

export type StaffReportTotals = {
  people: number;
  employees: number;
  contractors: number;
  active: number;
  left: number;
  /** Monthly wage bill for people still employed — what payroll costs a month. */
  monthlyWageBill: number;
};

const rateOf = (s: StaffMember) =>
  Number((s.pay_type === "Hourly" ? s.hourly_rate : s.pay_type === "Monthly" ? s.monthly_salary : s.daily_wage) ?? 0);

export function aggregateStaffRegister(staff: StaffMember[]): { rows: StaffReportRow[]; totals: StaffReportTotals } {
  const rows: StaffReportRow[] = staff.map((s) => ({
    id: s.id,
    name: s.full_name,
    employeeNumber: s.employee_number ?? "",
    employmentType: EMPLOYMENT_LABEL[s.employment_type] ?? s.employment_type,
    isContractor: !!s.is_contractor,
    payType: s.pay_type,
    rate: rateOf(s),
    daysPerWeek: Number(s.days_per_week ?? 0),
    hoursPerDay: Number(s.hours_per_day ?? 0),
    startDate: s.start_date ?? "",
    // A contractor has no start date (they aren't employed), so months employed
    // is only meaningful for staff.
    monthsEmployed: s.start_date ? monthsEmployedFrom(s.start_date) : 0,
    monthlyCost: monthlyRemunerationOf(s) + Number(s.recurring_allowance ?? 0),
    contractEndDate: s.contract_end_date ?? "",
    terminated: s.terminated === true,
    termEndDate: s.term_end_date ?? "",
    termReason: s.term_reason ?? "",
  }));

  const active = rows.filter((r) => !r.terminated);
  return {
    rows,
    totals: {
      people: rows.length,
      employees: rows.filter((r) => !r.isContractor).length,
      contractors: rows.filter((r) => r.isContractor).length,
      active: active.length,
      left: rows.length - active.length,
      // Anyone who has left costs nothing next month, so they're out of the bill.
      monthlyWageBill: active.reduce((s, r) => s + r.monthlyCost, 0),
    },
  };
}

// ── Advances ─────────────────────────────────────────────────────────────────

export type AdvanceEntry = { date: string; type: "advance" | "repayment"; amount: number; note: string };

export type AdvanceReportRow = {
  staffId: string;
  name: string;
  advanced: number;
  repaid: number;
  balance: number;
  /** The standing per-run deduction from the most recent advance that set one. */
  repayPerRun: number;
  /** Pay runs still to go at that rate — null when nothing is being deducted. */
  runsLeft: number | null;
  entries: AdvanceEntry[];
};

export type AdvanceReportTotals = { advanced: number; repaid: number; outstanding: number; people: number };

// One row per person, newest entry first, with what they were given, what Pay Run
// has taken back, and what's still owed.
export function aggregateAdvances(loans: WorkerLoan[]): { rows: AdvanceReportRow[]; totals: AdvanceReportTotals } {
  const byStaff = new Map<string, AdvanceReportRow>();

  for (const l of loans) {
    // staff_id is the identity; worker_name is the snapshot shown. Falling back to
    // the name keeps a row that lost its staff link out of a single "" bucket.
    const key = l.staff_id || `name-${l.worker_name}`;
    let row = byStaff.get(key);
    if (!row) {
      row = { staffId: l.staff_id ?? "", name: l.worker_name, advanced: 0, repaid: 0, balance: 0, repayPerRun: 0, runsLeft: null, entries: [] };
      byStaff.set(key, row);
    }
    const amount = Number(l.amount || 0);
    if (l.loan_type === "repayment") row.repaid += amount;
    else row.advanced += amount;
    row.entries.push({
      date: l.entry_date,
      type: l.loan_type === "repayment" ? "repayment" : "advance",
      amount,
      note: l.note ?? "",
    });
  }

  const rows = [...byStaff.values()].map((row) => {
    row.entries.sort((a, b) => b.date.localeCompare(a.date));
    // Clamped the same way getLoanBalance does: repayments can't push a balance
    // below zero, and an over-deduction shouldn't read as money owed to them.
    row.balance = Math.max(0, row.advanced - row.repaid);
    const plan = loans
      .filter((l) => (l.staff_id || `name-${l.worker_name}`) === (row.staffId || `name-${row.name}`))
      .filter((l) => l.loan_type === "advance" && l.repay_per_run != null && Number(l.repay_per_run) > 0)
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date))[0];
    row.repayPerRun = plan ? Number(plan.repay_per_run) : 0;
    row.runsLeft = row.repayPerRun > 0 && row.balance > 0 ? Math.ceil(row.balance / row.repayPerRun) : null;
    return row;
  });

  rows.sort((a, b) => a.name.localeCompare(b.name));

  return {
    rows,
    totals: {
      advanced: rows.reduce((s, r) => s + r.advanced, 0),
      repaid: rows.reduce((s, r) => s + r.repaid, 0),
      outstanding: rows.reduce((s, r) => s + r.balance, 0),
      people: rows.filter((r) => r.balance > 0).length,
    },
  };
}

// ── Leave ────────────────────────────────────────────────────────────────────

export type LeaveEntryRow = { date: string; endDate: string; type: string; days: number; note: string; fromPayRun: boolean };

export type LeaveReportRow = {
  staffId: string;
  name: string;
  startDate: string;
  /** Null for a contractor, who accrues no BCEA leave. */
  balances: LeaveBalances | null;
  terminated: boolean;
  entries: LeaveEntryRow[];
  totalDays: number;
};

export type LeaveReportTotals = { annual: number; sick: number; family: number; other: number; days: number };

// One row per employee with their BCEA balances and the leave behind them.
//
// worker_leave is the only source. create_pay_run writes a real leave row for the
// leave a pay run books (since 0085), so reading the pay runs as well — as the
// staff profile used to — counts that leave twice.
export function aggregateLeave(
  staff: StaffMember[],
  leaveRecords: WorkerLeaveRecord[]
): { rows: LeaveReportRow[]; totals: LeaveReportTotals } {
  const rows: LeaveReportRow[] = staff
    // A contractor takes no leave and accrues none; they're simply not part of
    // this report rather than a row of dashes.
    .filter((s) => !s.is_contractor)
    .map((s) => {
      const mine = leaveRecords.filter((l) => l.staff_id === s.id);
      const entries: LeaveEntryRow[] = mine
        .map((l) => ({
          date: l.start_date,
          endDate: l.end_date ?? "",
          type: l.leave_type,
          days: Number(l.days || 0),
          note: l.pay_run_id ? "From Pay Run" : l.note ?? "",
          fromPayRun: !!l.pay_run_id,
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
      return {
        staffId: s.id,
        name: s.full_name,
        startDate: s.start_date ?? "",
        balances: calcLeaveBalances(
          s.start_date,
          mine.map((l) => ({ leave_type: l.leave_type, days: Number(l.days || 0), date: l.start_date }))
        ),
        terminated: s.terminated === true,
        entries,
        totalDays: entries.reduce((t, e) => t + e.days, 0),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const all = rows.flatMap((r) => r.entries);
  // Sum the SAME scoped per-person figures the cards show (annual = current
  // period, sick = 3-year cycle, family = current year), so the tiles reconcile
  // with the cards instead of summing every entry all-time — which mixed windows
  // and could read a team total that no card explained.
  const sumScoped = (pick: (b: NonNullable<LeaveReportRow["balances"]>) => number) =>
    rows.reduce((s, r) => s + (r.balances ? pick(r.balances) : 0), 0);
  const annual = sumScoped((b) => b.annualTaken);
  const sick = sumScoped((b) => b.sickTaken);
  const family = sumScoped((b) => b.familyTaken);
  // "Other" leave types (Maternity/Parental/Unpaid) carry no statutory cycle, so
  // they stay all-time recorded. Total = the parts shown, so it reconciles too.
  const other = all.filter((e) => !["Annual", "Sick", "Family"].includes(e.type)).reduce((s, e) => s + e.days, 0);

  return {
    rows,
    totals: { annual, sick, family, other, days: annual + sick + family + other },
  };
}
