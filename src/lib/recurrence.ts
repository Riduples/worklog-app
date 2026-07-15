// Client-side mirror of the SQL recurrence_next() in migration 0044. The UI
// sets a template's FIRST next_run_date and the nightly job computes every one
// after it, so the two must agree exactly.
//
// The subtle part is month arithmetic. Postgres clamps
// ('2026-01-31'::date + interval '1 month' = 2026-02-28), whereas JS Date
// overflows (setMonth on Jan 31 lands on Mar 3). Naive JS would drift a
// month-end retainer onto the wrong date and disagree with the generator, so
// addMonths clamps to match Postgres.

export type Recurrence = "none" | "weekly" | "monthly" | "quarterly" | "annual";

// `every` is the noun form, so copy can read "every month" rather than the
// ungrammatical "every monthly".
export const RECURRENCE_OPTIONS: { id: Recurrence; label: string; every: string }[] = [
  { id: "none", label: "Once off", every: "" },
  { id: "weekly", label: "Weekly", every: "week" },
  { id: "monthly", label: "Monthly", every: "month" },
  { id: "quarterly", label: "Quarterly", every: "quarter" },
  { id: "annual", label: "Annually", every: "year" },
];

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: "Once off",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annually",
};

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const targetMonthIndex = m - 1 + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  // Day 0 of the following month == last day of the target month.
  const lastDayOfTarget = new Date(targetYear, targetMonth + 1, 0).getDate();
  return toIso(new Date(targetYear, targetMonth, Math.min(d, lastDayOfTarget)));
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toIso(new Date(y, m - 1, d + days));
}

// Returns null for "none" — a once-off invoice has no next run.
export function recurrenceNext(fromDate: string, recurrence: Recurrence): string | null {
  switch (recurrence) {
    case "weekly":
      return addDays(fromDate, 7);
    case "monthly":
      return addMonths(fromDate, 1);
    case "quarterly":
      return addMonths(fromDate, 3);
    case "annual":
      return addMonths(fromDate, 12);
    default:
      return null;
  }
}
