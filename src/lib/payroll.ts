// Shared payroll calculations — ported from worklog-v65.jsx's
// calcLeaveBalances/usePayrollData. Adapted to query staff_id-scoped rows
// from real tables instead of filtering one flat in-memory record array.

export type LeaveBalances = {
  months: number;
  annualAccrued: number;
  annualTaken: number;
  annualBalance: number;
  sickBalance: number;
  sickTaken: number;
  familyBalance: number;
  familyTaken: number;
};

export type LeaveEntry = { leave_type: string; days: number; date: string };

export function calcLeaveBalances(startDate: string | null, leaveEntries: LeaveEntry[]): LeaveBalances | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  const now = new Date();
  const months = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));

  const annualTaken = leaveEntries.filter((r) => r.leave_type === "Annual").reduce((s, r) => s + r.days, 0);
  const annualAccrued = Math.min(Math.floor(months * 1.25), 30);

  const cycleStart = new Date(start);
  cycleStart.setMonth(cycleStart.getMonth() + (months - (months % 36)));
  const sickTaken = leaveEntries
    .filter((r) => r.leave_type === "Sick" && new Date(r.date) >= cycleStart)
    .reduce((s, r) => s + r.days, 0);
  const familyTaken = leaveEntries
    .filter((r) => r.leave_type === "Family" && r.date.startsWith(String(now.getFullYear())))
    .reduce((s, r) => s + r.days, 0);

  return {
    months,
    annualAccrued,
    annualTaken,
    annualBalance: Math.max(0, annualAccrued - annualTaken),
    sickBalance: Math.max(0, 30 - sickTaken),
    sickTaken,
    familyBalance: Math.max(0, 3 - familyTaken),
    familyTaken,
  };
}

export function getLoanBalance(loans: { loan_type: string; amount: number }[]): number {
  const advances = loans.filter((l) => l.loan_type === "advance").reduce((s, l) => s + l.amount, 0);
  const repayments = loans.filter((l) => l.loan_type === "repayment").reduce((s, l) => s + l.amount, 0);
  return Math.max(0, advances - repayments);
}

export function rateLabel(fmt: (n: number) => string, payType: string, dailyWage: number, hourlyRate: number, monthlySalary: number): string {
  if (payType === "Hourly") return `${fmt(hourlyRate)}/hr`;
  if (payType === "Monthly") return `${fmt(monthlySalary)}/mo`;
  return `${fmt(dailyWage)}/day`;
}
