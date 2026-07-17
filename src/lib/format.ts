export const fmt = (n: number | string | null | undefined) =>
  `R ${Number(n || 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * The YYYY-MM-DD of a Date, read where the user is standing.
 *
 * Deliberately not `d.toISOString().split("T")[0]`, which is the obvious spelling
 * and is wrong here. toISOString() converts to UTC first, and this app is for
 * South Africa — UTC+2 — so it can name the wrong day:
 *
 *   * for a local-midnight Date (`new Date(y, m, 1)`), midnight SAST is 22:00
 *     the PREVIOUS day in UTC, so the answer is always a day early;
 *   * for the current instant, it is right for 22 hours and wrong between
 *     00:00 and 02:00 SAST — a shop logging a sale after midnight got
 *     yesterday's date written to transaction_date, and kept it.
 *
 * Reading the local parts sidesteps both. Every date this app stores or filters
 * on is a calendar day in the owner's day, never an instant, so local parts are
 * the right question to ask.
 */
export function toLocalIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayStr = () => toLocalIsoDate(new Date());

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};
