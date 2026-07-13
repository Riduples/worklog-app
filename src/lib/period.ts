export type Period = "today" | "week" | "month" | "all";

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  all: "All time",
};

// Returns a predicate that tests whether a YYYY-MM-DD date string falls in the period.
export function inPeriod(period: Period): (dateStr: string) => boolean {
  if (period === "all") return () => true;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === "today") {
    const key = startOfToday.toISOString().split("T")[0];
    return (d) => d === key;
  }

  if (period === "week") {
    // Week starts Monday (SA convention).
    const dow = (startOfToday.getDay() + 6) % 7; // 0 = Monday
    const monday = new Date(startOfToday);
    monday.setDate(startOfToday.getDate() - dow);
    const mondayKey = monday.toISOString().split("T")[0];
    return (d) => d >= mondayKey;
  }

  // month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  return (d) => d >= monthStart;
}
