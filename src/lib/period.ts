import { toLocalIsoDate } from "@/lib/format";

export type Period = "today" | "week" | "month" | "year" | "all";

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
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

  if (period === "year") {
    // The whole calendar year, Jan 1 to Dec 31 — effectively year-to-date for
    // normal data, since transactions aren't dated in the future.
    const from = toLocalIsoDate(new Date(now.getFullYear(), 0, 1));
    const to = toLocalIsoDate(new Date(now.getFullYear(), 11, 31));
    return (d) => d >= from && d <= to;
  }

  // month — the 0th of next month is the last of this one, and it handles
  // February and leap years without being told about them.
  const from = toLocalIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = toLocalIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return (d) => d >= from && d <= to;
}

// ── SA tax year (1 March – 28/29 February) ──────────────────────────────────
// The SARS travel logbook is kept per tax year, which is NOT the calendar year
// inPeriod("year") uses. A tax year is identified by the calendar year it STARTS
// in: 2025 = 1 Mar 2025 → 28/29 Feb 2026. These helpers stay out of the Period
// enum on purpose — adding a value there would sprout a "Tax year" pill on every
// PeriodSelector (Profit & Loss, Cash Flow…), where it doesn't belong. The Travel
// Report drives its tax-year filter from these directly instead.

/** The start-year of the tax year a YYYY-MM-DD date falls in. Jan/Feb belong to
 *  the tax year that opened the previous calendar year. */
export function taxYearStartYearOf(dateStr: string): number {
  const [y, m] = dateStr.split("-").map(Number);
  return m <= 2 ? y - 1 : y;
}

/** The start-year of the tax year we're currently in. */
export function currentTaxYearStartYear(): number {
  const now = new Date();
  return now.getMonth() + 1 <= 2 ? now.getFullYear() - 1 : now.getFullYear();
}

/** The [from, to] YYYY-MM-DD span of the tax year starting in `startYear`. */
export function taxYearRange(startYear: number): { from: string; to: string } {
  return {
    from: toLocalIsoDate(new Date(startYear, 2, 1)), // 1 March
    to: toLocalIsoDate(new Date(startYear + 1, 2, 0)), // last day of Feb next year
  };
}

/** Short "2025/26" label for the tax year starting in `startYear`. */
export function taxYearLabel(startYear: number): string {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Full "1 Mar 2025 – 28 Feb 2026" span for the tax year starting in `startYear`. */
export function taxYearDateLabel(startYear: number): string {
  const fmtD = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  };
  const { from, to } = taxYearRange(startYear);
  return `${fmtD(from)} – ${fmtD(to)}`;
}
