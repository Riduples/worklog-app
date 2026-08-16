import { describe, expect, it } from "vitest";
import { aggregateAdvances, aggregateLeave, aggregateStaffRegister } from "./payrollReports";
import type { StaffMember } from "@/lib/supabase/hooks/useStaffRegister";
import type { WorkerLoan } from "@/lib/supabase/hooks/useWorkerLoans";
import type { WorkerLeaveRecord } from "@/lib/supabase/hooks/useWorkerLeave";

// Minimal fixtures — the aggregation reads a handful of fields, so we cast
// partial rows rather than build full DB objects.
const staff = (s: Partial<StaffMember>): StaffMember =>
  ({
    id: "s1",
    full_name: "Sipho Dlamini",
    employment_type: "permanent",
    is_contractor: false,
    pay_type: "Monthly",
    monthly_salary: 10000,
    daily_wage: 0,
    hourly_rate: 0,
    days_per_week: 5,
    hours_per_day: 8,
    recurring_allowance: 0,
    start_date: "2020-01-01",
    terminated: false,
    ...s,
  }) as StaffMember;

const loan = (l: Partial<WorkerLoan>): WorkerLoan =>
  ({ id: "l1", staff_id: "s1", worker_name: "Sipho Dlamini", loan_type: "advance", amount: 0, entry_date: "2026-01-10", note: null, repay_per_run: null, ...l }) as WorkerLoan;

const leave = (l: Partial<WorkerLeaveRecord>): WorkerLeaveRecord =>
  ({ id: "v1", staff_id: "s1", worker_name: "Sipho Dlamini", leave_type: "Annual", days: 1, start_date: "2026-01-10", end_date: null, note: null, pay_run_id: null, ...l }) as WorkerLeaveRecord;

describe("aggregateStaffRegister", () => {
  it("counts employees, contractors and who has left", () => {
    const { totals } = aggregateStaffRegister([
      staff({ id: "a" }),
      staff({ id: "b", employment_type: "contractor", is_contractor: true, start_date: null }),
      staff({ id: "c", terminated: true }),
    ]);
    expect(totals.people).toBe(3);
    expect(totals.employees).toBe(2);
    expect(totals.contractors).toBe(1);
    expect(totals.active).toBe(2);
    expect(totals.left).toBe(1);
  });

  it("bills the monthly wage only for people still employed, allowance included", () => {
    const { totals } = aggregateStaffRegister([
      staff({ id: "a", monthly_salary: 10000, recurring_allowance: 500 }),
      staff({ id: "b", monthly_salary: 8000, terminated: true }),
    ]);
    expect(totals.monthlyWageBill).toBe(10500);
  });

  it("derives a daily worker's monthly cost from days per week", () => {
    const { rows } = aggregateStaffRegister([staff({ pay_type: "Daily", daily_wage: 400, monthly_salary: 0, days_per_week: 5 })]);
    expect(rows[0].monthlyCost).toBeCloseTo(400 * 5 * 4.33, 5);
  });
});

describe("aggregateAdvances", () => {
  it("nets repayments off advances per person", () => {
    const { rows, totals } = aggregateAdvances([
      loan({ id: "1", amount: 1000 }),
      loan({ id: "2", amount: 300, loan_type: "repayment" }),
      loan({ id: "3", staff_id: "s2", worker_name: "Thandi Nkosi", amount: 500 }),
    ]);
    const sipho = rows.find((r) => r.staffId === "s1")!;
    expect(sipho.advanced).toBe(1000);
    expect(sipho.repaid).toBe(300);
    expect(sipho.balance).toBe(700);
    expect(totals.advanced).toBe(1500);
    expect(totals.repaid).toBe(300);
    expect(totals.outstanding).toBe(1200);
    expect(totals.people).toBe(2);
  });

  it("never shows a negative balance when more was deducted than advanced", () => {
    const { rows, totals } = aggregateAdvances([loan({ id: "1", amount: 100 }), loan({ id: "2", amount: 250, loan_type: "repayment" })]);
    expect(rows[0].balance).toBe(0);
    expect(totals.outstanding).toBe(0);
    expect(totals.people).toBe(0);
  });

  it("reads the repayment plan off the most recent advance that set one", () => {
    const { rows } = aggregateAdvances([
      loan({ id: "1", amount: 1000, entry_date: "2026-01-10", repay_per_run: 100 }),
      loan({ id: "2", amount: 500, entry_date: "2026-03-01", repay_per_run: 250 }),
    ]);
    expect(rows[0].repayPerRun).toBe(250);
    expect(rows[0].runsLeft).toBe(6); // 1500 outstanding / 250 a run
  });

  it("has no runs left to report when nothing is being deducted", () => {
    const { rows } = aggregateAdvances([loan({ amount: 1000 })]);
    expect(rows[0].repayPerRun).toBe(0);
    expect(rows[0].runsLeft).toBeNull();
  });

  it("lists a person's entries newest first", () => {
    const { rows } = aggregateAdvances([
      loan({ id: "1", amount: 100, entry_date: "2026-01-01" }),
      loan({ id: "2", amount: 200, entry_date: "2026-05-01" }),
    ]);
    expect(rows[0].entries.map((e) => e.date)).toEqual(["2026-05-01", "2026-01-01"]);
  });
});

describe("aggregateLeave", () => {
  it("counts pay-run leave once — worker_leave already holds the row Pay Run wrote", () => {
    const { rows, totals } = aggregateLeave([staff({})], [leave({ id: "v1", days: 3, pay_run_id: "pr1" })]);
    expect(totals.annual).toBe(3);
    expect(rows[0].totalDays).toBe(3);
    expect(rows[0].balances?.annualTaken).toBe(3);
    expect(rows[0].entries[0].fromPayRun).toBe(true);
  });

  it("splits the totals by leave type", () => {
    const { totals } = aggregateLeave(
      [staff({})],
      [
        leave({ id: "1", leave_type: "Annual", days: 5 }),
        leave({ id: "2", leave_type: "Sick", days: 2 }),
        leave({ id: "3", leave_type: "Family", days: 1 }),
        leave({ id: "4", leave_type: "Unpaid", days: 4 }),
      ]
    );
    expect(totals).toMatchObject({ annual: 5, sick: 2, family: 1, other: 4, days: 12 });
  });

  it("leaves contractors out — they accrue no BCEA leave", () => {
    const { rows } = aggregateLeave([staff({ id: "c", is_contractor: true, employment_type: "contractor" })], []);
    expect(rows).toHaveLength(0);
  });

  it("keeps each person's leave to their own row", () => {
    const { rows } = aggregateLeave(
      [staff({ id: "s1", full_name: "Aaa" }), staff({ id: "s2", full_name: "Bbb" })],
      [leave({ id: "1", staff_id: "s1", days: 2 }), leave({ id: "2", staff_id: "s2", days: 7 })]
    );
    expect(rows.map((r) => r.totalDays)).toEqual([2, 7]);
  });
});
