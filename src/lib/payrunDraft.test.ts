import { describe, expect, it } from "vitest";
import { computeRun, draftForWorker, EMPTY_DRAFT, loanBalanceOf, type Draft, type RunWorker } from "./payrunDraft";

const round = (n: number) => Math.round(n * 100) / 100;

// Same worked month as payrunCalc.test.ts: August 2025, 21 Mon–Fri working days.
const PERIOD = { periodStart: "2025-08-01", periodEnd: "2025-08-31", payPeriod: "Monthly" as const };

const stubs = {
  calcUIF: (gross: number) => ({ employee: round(gross * 0.01), employer: round(gross * 0.01), total: round(gross * 0.02) }),
  calcPAYE: (monthly: number) => (monthly > 10000 ? round((monthly - 10000) * 0.18) : 0),
  sdlRegistered: false,
  sdlRate: 0.01,
  loanBalance: 0,
  leaveRecords: [],
};

const salaried: RunWorker = {
  id: "w1",
  full_name: "Melie Smelie",
  pay_type: "Monthly",
  is_contractor: false,
  monthly_salary: 25000,
  days_per_week: 5,
  hours_per_day: 8,
  start_date: "2023-02-01",
  terminated: false,
  recurring_allowance: 0,
};

const waged: RunWorker = {
  id: "w2",
  full_name: "Sipho Ndlovu",
  pay_type: "Daily",
  is_contractor: false,
  daily_wage: 400,
  days_per_week: 5,
  hours_per_day: 8,
  start_date: "2024-06-03",
  terminated: false,
  recurring_allowance: 0,
};

const run = (worker: RunWorker, draft: Partial<Draft> = {}, extra: Partial<Parameters<typeof computeRun>[0]> = {}) =>
  computeRun({ worker, draft: { ...EMPTY_DRAFT, ...draft }, ...PERIOD, ...stubs, ...extra });

describe("loanBalanceOf", () => {
  it("nets repayments off advances and never goes below zero", () => {
    expect(loanBalanceOf([{ loan_type: "advance", amount: 1500 }, { loan_type: "repayment", amount: 500 }])).toBe(1000);
    expect(loanBalanceOf([{ loan_type: "advance", amount: 500 }, { loan_type: "repayment", amount: 900 }])).toBe(0);
  });
});

describe("draftForWorker", () => {
  it("pulls the standing allowance and the agreed advance repayment in", () => {
    const d = draftForWorker({ ...salaried, recurring_allowance: 750, recurring_allowance_desc: "Travel" }, [
      { loan_type: "advance", amount: 2000, repay_per_run: 500 },
    ]);
    expect(d.allowance).toBe("750");
    expect(d.allowanceDesc).toBe("Travel");
    expect(d.showAllowance).toBe(true);
    expect(d.loanDeduction).toBe("500");
  });

  it("never pre-fills a repayment bigger than what is still owed", () => {
    const d = draftForWorker(salaried, [
      { loan_type: "advance", amount: 2000, repay_per_run: 500 },
      { loan_type: "repayment", amount: 1800 },
    ]);
    expect(d.loanDeduction).toBe("200");
  });

  it("pre-fills nothing when there is no allowance and no advance", () => {
    const d = draftForWorker(salaried, []);
    expect(d.allowance).toBe("");
    expect(d.loanDeduction).toBe("");
    expect(d.showAllowance).toBe(false);
  });
});

describe("computeRun — days and pay", () => {
  it("pays a full month's salary exactly", () => {
    const r = run(salaried);
    expect(r.units).toBe(21);
    expect(r.unitsAreAuto).toBe(true);
    expect(Math.round(r.money.basic)).toBe(25000);
  });

  it("prorates a mid-month starter off the same month's working days", () => {
    const r = run({ ...salaried, start_date: "2025-08-18" });
    expect(r.days.proratedStart).toBe(true);
    expect(r.units).toBe(10);
    // 10 of the month's 21 working days.
    expect(r.money.basic).toBe(round(round(25000 / 21) * 10));
  });

  it("stops at the last day worked for someone who has left", () => {
    const r = run({ ...salaried, terminated: true, term_end_date: "2025-08-15" });
    expect(r.units).toBe(11);
  });

  it("ignores a planned last day for someone still employed", () => {
    const r = run({ ...salaried, terminated: false, term_end_date: "2025-08-15" });
    expect(r.units).toBe(21);
  });

  it("takes recorded unpaid leave off the days, and charges UIF on the lower gross", () => {
    const withLeave = run(waged, {}, { leaveRecords: [{ leave_type: "Unpaid", days: 2, start_date: "2025-08-12" }] });
    const without = run(waged);
    expect(withLeave.units).toBe(19);
    expect(withLeave.money.gross).toBe(7600);
    expect(withLeave.money.uifEmployee).toBeLessThan(without.money.uifEmployee);
    expect(withLeave.unpaidLeaveDays).toBe(2);
    expect(withLeave.unpaidLeaveValue).toBe(800);
    // The net is gross less the deductions — the unpaid days are not taken off
    // a second time.
    expect(withLeave.money.net).toBe(round(withLeave.money.gross - withLeave.money.totalDeductions));
  });

  it("leaves paid leave paid", () => {
    const r = run(waged, {}, { leaveRecords: [{ leave_type: "Annual", days: 3, start_date: "2025-08-12" }] });
    expect(r.units).toBe(21);
    expect(r.registerLeave.paidDays).toBe(3);
    expect(r.money.gross).toBe(8400);
  });

  it("keeps leave typed on the run separate from leave already in the register", () => {
    const r = run(waged, { extraLeaveDays: "1", extraLeaveType: "Unpaid" }, { leaveRecords: [{ leave_type: "Unpaid", days: 2, start_date: "2025-08-12" }] });
    expect(r.registerLeave.unpaidDays).toBe(2);
    expect(r.extraUnpaidLeaveDays).toBe(1);
    // Both reduce the days; only the extra day is the run's to record.
    expect(r.units).toBe(18);
  });

  it("lets a typed day count override the calculated one", () => {
    const r = run(waged, { unitsInput: "15" });
    expect(r.unitsAreAuto).toBe(false);
    expect(r.units).toBe(15);
    expect(r.money.basic).toBe(6000);
    // The calculation is still there to compare against.
    expect(r.days.units).toBe(21);
  });

  it("counts hours, not days, for an hourly worker", () => {
    const r = run({ ...waged, pay_type: "Hourly", hourly_rate: 55, hours_per_day: 9 });
    expect(r.rates.unitLabel).toBe("hours");
    expect(r.units).toBe(189);
    expect(r.money.basic).toBe(round(189 * 55));
  });
});

describe("computeRun — overtime", () => {
  it("prices overtime hours off the derived hourly rate for a day-wage worker", () => {
    const r = run(waged, { otUnits: "6", otBasis: "hours", otMultiplier: "1.5" });
    // R400/day ÷ 8 = R50/hour × 1.5 × 6.
    expect(r.overtimeAmount).toBe(450);
    expect(r.overtimeIsAuto).toBe(true);
    // en-ZA money, the same shape the app prints: comma decimal, space thousands.
    expect(r.overtime.explain).toContain("R 50,00/hour");
  });

  it("prices extra days off the daily rate", () => {
    const r = run(waged, { otUnits: "1", otBasis: "days", otMultiplier: "2" });
    expect(r.overtimeAmount).toBe(800);
  });

  it("lets the overtime amount be typed in directly", () => {
    const r = run(waged, { otUnits: "6", otBasis: "hours", otMultiplier: "1.5", otAmountInput: "500" });
    expect(r.overtimeIsAuto).toBe(false);
    expect(r.overtimeAmount).toBe(500);
    // The calculated figure stays available to show beside it.
    expect(r.overtime.amount).toBe(450);
  });
});

describe("computeRun — deductions", () => {
  it("never deducts more advance than is owed", () => {
    const r = run(waged, { loanDeduction: "5000" }, { loanBalance: 1200 });
    expect(r.money.loanDeduction).toBe(1200);
    expect(r.loanBalanceAfter).toBe(0);
  });

  it("shows what the advance balance drops to", () => {
    const r = run(waged, { loanDeduction: "500" }, { loanBalance: 1200 });
    expect(r.loanBalanceAfter).toBe(700);
  });

  it("gives a contractor no UIF, PAYE or SDL", () => {
    const r = run({ ...waged, is_contractor: true }, {}, { sdlRegistered: true });
    expect(r.money.uifEmployee).toBe(0);
    expect(r.money.paye).toBe(0);
    expect(r.money.sdl).toBe(0);
    expect(r.money.net).toBe(r.money.gross);
  });

  it("adds the allowance to gross and the other deduction to the deductions", () => {
    const r = run(waged, { allowance: "600", allowanceDesc: "Travel", otherDeduction: "150" });
    expect(r.money.gross).toBe(9000);
    expect(r.money.otherDeduction).toBe(150);
    expect(r.money.net).toBe(round(9000 - r.money.uifEmployee - r.money.paye - 150));
  });
});
