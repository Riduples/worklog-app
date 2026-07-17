import { toLocalIsoDate } from "@/lib/format";

export type Period = "today" | "week" | "month" | "all";

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  all: "All time",
};

/**
 * Returns a predicate that tests whether a YYYY-MM-DD date string falls in the period.
 *
 * Two things this gets right that the first version didn't.
 *
 * Dates are read locally, via toLocalIsoDate. The old code built a local-midnight
 * Date and then called .toISOString() on it, which converts to UTC — and in SAST
 * that lands at 22:00 the previous day, so every boundary was a day early.
 * "Today" filtered for yesterday and hid the row you had just logged, because
 * todayStr() wrote the real local date. It was correct under UTC, which is
 * exactly why nobody caught it: the tests, the CI and the developer were all in
 * the one timezone where the bug doesn't exist.
 *
 * The periods are now closed at both ends. "This month" used to be `d >= start`
 * with no upper bound, so a post-dated invoice counted in this month's profit —
 * while the dashboard's own month check compared year and month and excluded it.
 * Two screens, two answers, same month. A period with a name like "this month"
 * means that month, so it ends when the month does.
 */
export function inPeriod(period: Period): (dateStr: string) => boolean {
  if (period === "all") return () => true;

  const now = new Date();

  if (period === "today") {
    const key = toLocalIsoDate(now);
    return (d) => d === key;
  }

  if (period === "week") {
    // Week starts Monday (SA convention).
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dow = (startOfToday.getDay() + 6) % 7; // 0 = Monday
    const monday = new Date(startOfToday);
    monday.setDate(startOfToday.getDate() - dow);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const from = toLocalIsoDate(monday);
    const to = toLocalIsoDate(sunday);
    return (d) => d >= from && d <= to;
  }

  // month — the 0th of next month is the last of this one, and it handles
  // February and leap years without being told about them.
  const from = toLocalIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = toLocalIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return (d) => d >= from && d <= to;
}
