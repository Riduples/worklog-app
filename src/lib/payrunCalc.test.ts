import { describe, expect, it } from "vitest";
import {
  calcDaysWorked,
  calcOvertime,
  calcRunMoney,
  countCalendarDays,
  countWorkingDays,
  leaveInPeriod,
  periodForPayDate,
  workerRates,
} from "./payrunCalc";

// August 2025 is the worked example throughout: 31 days, starting on a Friday,
// 21 Mon–Fri working days. Chosen because 21 ≠ 21.65 (the 4.33-week average the
// old wizard divided a salary by), so the proration bug is visible in it.

describe("periodForPayDate", () => {
  it("covers the whole calendar month of a monthly pay date", () => {
    expect(periodForPayDate("2025-08-25", "Monthly")).toEqual({ start: "2025-08-01", end: "2025-08-31" });
  });

  it("handles February in a leap year", () => {
    expect(periodForPayDate("2024-02-25", "Monthly")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
  });

  it("covers the 7 days ending on a weekly pay date", () => {
    expect(periodForPayDate("2025-08-08", "Weekly")).toEqual({ start: "2025-08-02", end: "2025-08-08" });
  });

  it("covers the 14 days ending on a fortnightly pay date", () => {
    expect(periodForPayDate("2025-08-15", "Fortnightly")).toEqual({ start: "2025-08-02", end: "2025-08-15" });
  });
});

describe("countWorkingDays", () => {
  it("counts Mon–Fri for a five-day week", () => {
    expect(countWorkingDays("2025-08-01", "2025-08-31", 5)).toBe(21);
  });

  it("counts Mon–Sat for a six-day week", () => {
    expect(countWorkingDays("2025-08-01", "2025-08-31", 6)).toBe(26);
  });

  it("counts every day for a seven-day week", () => {
    expect(countWorkingDays("2025-08-01", "2025-08-31", 7)).toBe(31);
  });

  it("is inclusive of both ends", () => {
    // Monday to Friday, one week.
    expect(countWorkingDays("2025-08-04", "2025-08-08", 5)).toBe(5);
  });

  it("returns 0 for a reversed or empty range", () => {
    expect(countWorkingDays("2025-08-31", "2025-08-01", 5)).toBe(0);
    expect(countWorkingDays("", "2025-08-01", 5)).toBe(0);
  });

  it("does not shift a day at UTC+2", () => {
    // The suite runs at Africa/Johannesburg. A UTC-parsed "2025-08-04" is the
    // Sunday before, which would make this 6 rather than 5.
    expect(countWorkingDays("2025-08-04", "2025-08-10", 5)).toBe(5);
  });
});

describe("countCalendarDays", () => {
  it("counts inclusively", () => {
    expect(countCalendarDays("2025-08-01", "2025-08-31")).toBe(31);
    expect(countCalendarDays("2025-08-01", "2025-08-01")).toBe(1);
  });
});

describe("leaveInPeriod", () => {
  const period = { start: "2025-08-01", end: "2025-08-31" };

  it("splits paid from unpaid leave", () => {
    const r = leaveInPeriod(
      [
        { leave_type: "Annual", days: 3, start_date: "2025-08-11" },
        { leave_type: "Sick", days: 1, start_date: "2025-08-20" },
        { leave_type: "Unpaid", days: 2, start_date: "2025-08-25" },
      ],
      period.start,
      period.end
    );
    expect(r.paidDays).toBe(4);
    expect(r.unpaidDays).toBe(2);
    expect(r.paidByType).toEqual({ Annual: 3, Sick: 1 });
  });

  it("ignores leave outside the period", () => {
    const r = leaveInPeriod([{ leave_type: "Annual", days: 5, start_date: "2025-07-14" }], period.start, period.end);
    expect(r.paidDays).toBe(0);
    expect(r.entries).toHaveLength(0);
  });

  it("counts only the share of a straddling record that falls inside", () => {
    // 30 Jul – 4 Aug is 6 calendar days, 4 of them in August, for 6 leave days.
    const r = leaveInPeriod([{ leave_type: "Annual", days: 6, start_date: "2025-07-30", end_date: "2025-08-04" }], period.start, period.end);
    expect(r.paidDays).toBe(4);
  });

  it("treats a record with no end date as landing on its start date", () => {
    const r = leaveInPeriod([{ leave_type: "Unpaid", days: 2, start_date: "2025-08-31", end_date: null }], period.start, period.end);
    expect(r.unpaidDays).toBe(2);
  });
});

describe("calcDaysWorked", () => {
  const base = {
    periodStart: "2025-08-01",
    periodEnd: "2025-08-31",
    daysPerWeek: 5,
    hoursPerDay: 8,
    payType: "Monthly",
  };

  it("pays every working day of a full month", () => {
    const c = calcDaysWorked(base);
    expect(c.scheduledDays).toBe(21);
    expect(c.daysPaid).toBe(21);
    expect(c.units).toBe(21);
    expect(c.proratedStart).toBe(false);
  });

  it("prorates from a mid-period start date", () => {
    // Started Monday 18 Aug: 18–31 August holds 10 weekdays.
    const c = calcDaysWorked({ ...base, employmentStart: "2025-08-18" });
    expect(c.proratedStart).toBe(true);
    expect(c.from).toBe("2025-08-18");
    expect(c.scheduledDays).toBe(10);
    expect(c.daysPaid).toBe(10);
    // The rate base stays the whole month, so 10/21 of the salary is paid.
    expect(c.fullPeriodDays).toBe(21);
  });

  it("prorates to a last day worked", () => {
    const c = calcDaysWorked({ ...base, employmentEnd: "2025-08-15" });
    expect(c.proratedEnd).toBe(true);
    expect(c.to).toBe("2025-08-15");
    expect(c.scheduledDays).toBe(11);
  });

  it("ignores an employment start before the period", () => {
    const c = calcDaysWorked({ ...base, employmentStart: "2021-01-04" });
    expect(c.proratedStart).toBe(false);
    expect(c.scheduledDays).toBe(21);
  });

  it("takes unpaid leave off the days and leaves paid leave alone", () => {
    const c = calcDaysWorked({ ...base, paidLeaveDays: 3, unpaidLeaveDays: 2 });
    expect(c.scheduledDays).toBe(21);
    expect(c.unpaidLeaveDays).toBe(2);
    expect(c.paidLeaveDays).toBe(3);
    expect(c.daysPaid).toBe(19);
  });

  it("never takes off more unpaid leave than there are days", () => {
    const c = calcDaysWorked({ ...base, unpaidLeaveDays: 40 });
    expect(c.daysPaid).toBe(0);
    expect(c.unpaidLeaveDays).toBe(21);
  });

  it("returns hours for an hourly worker", () => {
    const c = calcDaysWorked({ ...base, payType: "Hourly", hoursPerDay: 9 });
    expect(c.unitLabel).toBe("hours");
    expect(c.units).toBe(21 * 9);
  });

  it("shows its working, prorated ends and all", () => {
    const c = calcDaysWorked({ ...base, employmentStart: "2025-08-18", unpaidLeaveDays: 1 });
    const labels = c.lines.map((l) => l.label);
    expect(labels.some((l) => l.startsWith("Period 2025-08-01"))).toBe(true);
    expect(labels.some((l) => l.includes("Started 2025-08-18"))).toBe(true);
    expect(labels.some((l) => l.includes("Less unpaid leave"))).toBe(true);
    expect(c.lines.at(-1)).toEqual({ label: "Days paid", value: "9 days", kind: "total" });
  });
});

describe("workerRates", () => {
  it("divides a monthly salary by the working days in THIS period", () => {
    // The old wizard used days_per_week × 4.33 = 21.65 for every month, so a
    // full 21-day August paid R24 249 of a R25 000 salary. It now pays R25 000.
    const r = workerRates({ pay_type: "Monthly", monthly_salary: 25000, days_per_week: 5, hours_per_day: 8 }, 21);
    expect(r.dailyRate).toBe(1190.48);
    expect(Math.round(r.dailyRate * 21)).toBe(25000);
    expect(r.unitRate).toBe(r.dailyRate);
  });

  it("falls back to the 4.33-week average when the period has no working days", () => {
    const r = workerRates({ pay_type: "Monthly", monthly_salary: 25000, days_per_week: 5 }, 0);
    expect(r.dailyRate).toBe(round(25000 / 21.65));
  });

  it("derives an hourly rate from a daily wage for overtime", () => {
    const r = workerRates({ pay_type: "Daily", daily_wage: 400, hours_per_day: 8 }, 21);
    expect(r.dailyRate).toBe(400);
    expect(r.hourlyRate).toBe(50);
    expect(r.unitLabel).toBe("days");
  });

  it("prices an hourly worker per hour and derives their day", () => {
    const r = workerRates({ pay_type: "Hourly", hourly_rate: 60, hours_per_day: 9 }, 21);
    expect(r.unitRate).toBe(60);
    expect(r.dailyRate).toBe(540);
    expect(r.unitLabel).toBe("hours");
  });
});

const round = (n: number) => Math.round(n * 100) / 100;

describe("calcOvertime", () => {
  it("prices overtime hours off the hourly rate", () => {
    const ot = calcOvertime({ units: 6, basis: "hours", multiplier: 1.5, dailyRate: 400, hourlyRate: 50 });
    expect(ot.amount).toBe(450);
    expect(ot.explain).toContain("6 hours");
    expect(ot.explain).toContain("1.5");
  });

  it("prices extra days off the daily rate", () => {
    const ot = calcOvertime({ units: 2, basis: "days", multiplier: 2, dailyRate: 400, hourlyRate: 50 });
    expect(ot.amount).toBe(1600);
  });

  it("treats a missing multiplier as standard overtime", () => {
    const ot = calcOvertime({ units: 2, basis: "hours", multiplier: 0, dailyRate: 400, hourlyRate: 50 });
    expect(ot.amount).toBe(150);
  });

  it("never returns negative overtime", () => {
    expect(calcOvertime({ units: -4, basis: "hours", multiplier: 1.5, dailyRate: 400, hourlyRate: 50 }).amount).toBe(0);
  });
});

describe("calcRunMoney", () => {
  const stubs = {
    calcUIF: (gross: number) => ({ employee: round(gross * 0.01), employer: round(gross * 0.01), total: round(gross * 0.02) }),
    calcPAYE: (monthly: number) => (monthly > 8000 ? round((monthly - 8000) * 0.18) : 0),
  };

  it("adds basic, overtime and allowance into gross and deducts from it", () => {
    const m = calcRunMoney({
      unitRate: 400,
      units: 20,
      overtimeAmount: 450,
      allowanceAmount: 500,
      isContractor: false,
      sdlRegistered: true,
      sdlRate: 0.01,
      payPeriod: "Monthly",
      loanDeduction: 200,
      otherDeduction: 100,
      ...stubs,
    });
    expect(m.basic).toBe(8000);
    expect(m.gross).toBe(8950);
    expect(m.uifEmployee).toBe(89.5);
    expect(m.sdl).toBe(89.5);
    expect(m.paye).toBe(171);
    expect(m.net).toBe(round(8950 - 89.5 - 171 - 200 - 100));
    expect(m.employerCost).toBe(179);
  });

  it("charges a contractor no UIF, PAYE or SDL", () => {
    const m = calcRunMoney({
      unitRate: 400,
      units: 20,
      overtimeAmount: 0,
      allowanceAmount: 0,
      isContractor: true,
      sdlRegistered: true,
      sdlRate: 0.01,
      payPeriod: "Monthly",
      loanDeduction: 0,
      otherDeduction: 0,
      ...stubs,
    });
    expect(m.uifEmployee).toBe(0);
    expect(m.paye).toBe(0);
    expect(m.sdl).toBe(0);
    expect(m.net).toBe(8000);
  });

  it("annualises a weekly gross for PAYE rather than taxing it as a month", () => {
    const m = calcRunMoney({
      unitRate: 400,
      units: 5,
      overtimeAmount: 0,
      allowanceAmount: 0,
      isContractor: false,
      sdlRegistered: false,
      sdlRate: 0.01,
      payPeriod: "Weekly",
      loanDeduction: 0,
      otherDeduction: 0,
      ...stubs,
    });
    expect(m.gross).toBe(2000);
    expect(m.monthlyEquivalent).toBe(8660);
  });

  it("charges UIF and PAYE on the reduced gross when unpaid leave cut the days", () => {
    // 19 days instead of 21: the employee pays UIF on what they earned, and the
    // wage expense on the books is the wage actually paid. The old wizard grossed
    // the full 21 days and subtracted the unpaid leave from the net instead.
    const full = calcRunMoney({ unitRate: 400, units: 21, overtimeAmount: 0, allowanceAmount: 0, isContractor: false, sdlRegistered: false, sdlRate: 0.01, payPeriod: "Monthly", loanDeduction: 0, otherDeduction: 0, ...stubs });
    const short = calcRunMoney({ unitRate: 400, units: 19, overtimeAmount: 0, allowanceAmount: 0, isContractor: false, sdlRegistered: false, sdlRate: 0.01, payPeriod: "Monthly", loanDeduction: 0, otherDeduction: 0, ...stubs });
    expect(short.gross).toBe(7600);
    expect(short.uifEmployee).toBeLessThan(full.uifEmployee);
    expect(short.net).toBe(round(7600 - 76));
  });
});
