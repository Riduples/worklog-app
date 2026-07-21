import { afterEach, describe, expect, it, vi } from "vitest";
import { inPeriod } from "./period";
import { toLocalIsoDate, todayStr } from "./format";

// These run at Africa/Johannesburg (vitest.config.ts) because that is where the
// users are, and because at UTC every assertion below passes against the broken
// code. The bug was a day-shift at UTC+2 and nothing else; a suite at offset 0
// is blind to it by construction.
//
// Clock is frozen per test so "today" means a date we chose rather than whatever
// day CI happens to run on.
const at = (localIso: string) => vi.setSystemTime(new Date(localIso));
afterEach(() => vi.useRealTimers());

describe("toLocalIsoDate", () => {
  it("reads the day where the user is standing, not in UTC", () => {
    // 00:30 SAST on the 17th is still the 16th in UTC. The old
    // toISOString().split("T")[0] returned the 16th.
    expect(toLocalIsoDate(new Date("2026-07-16T22:30:00Z"))).toBe("2026-07-17");
  });

  it("names a local-midnight date as itself", () => {
    // The shape every period boundary is built from: new Date(y, m, d) is local
    // midnight, which in SAST is 22:00 the previous day UTC.
    expect(toLocalIsoDate(new Date(2026, 6, 1))).toBe("2026-07-01");
    expect(toLocalIsoDate(new Date(2026, 6, 31))).toBe("2026-07-31");
  });

  it("pads single-digit months and days", () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("todayStr", () => {
  it("is the local date at midday", () => {
    vi.useFakeTimers();
    at("2026-07-17T09:33:00Z"); // 11:33 SAST
    expect(todayStr()).toBe("2026-07-17");
  });

  it("is still the local date just after midnight", () => {
    // The one that mattered: a shop logging a sale at 00:30 SAST used to write
    // yesterday's date to transaction_date, and keep it.
    vi.useFakeTimers();
    at("2026-07-16T22:30:00Z"); // 00:30 SAST on the 17th
    expect(todayStr()).toBe("2026-07-17");
  });

  // The whole bug in one line: log a sale now, then look at Today.
  //
  // Checked at midday deliberately. Just after midnight the old todayStr() and
  // the old inPeriod("today") were both a day early — they agreed, wrongly, and
  // an assertion that they merely match would have passed against the broken
  // code. It's the rest of the day, when only one of them shifts, that the row
  // actually disappeared.
  it.each([
    ["midday", "2026-07-17T09:33:00Z", "2026-07-17"], // 11:33 SAST — where they used to disagree
    ["just after midnight", "2026-07-16T22:30:00Z", "2026-07-17"], // 00:30 SAST — where they agreed, wrongly
  ])("a row logged at %s shows up under Today", (_when, instant, expected) => {
    vi.useFakeTimers();
    at(instant);
    const written = todayStr(); // what IncomeModal puts in transaction_date
    expect(written).toBe(expected);
    expect(inPeriod("today")(written)).toBe(true);
  });
});

describe("inPeriod('today')", () => {
  it("matches today and nothing either side of it", () => {
    vi.useFakeTimers();
    at("2026-07-17T09:33:00Z"); // 11:33 SAST
    const today = inPeriod("today");
    expect(today("2026-07-17")).toBe(true);
    expect(today("2026-07-16")).toBe(false); // used to be the only match
    expect(today("2026-07-18")).toBe(false);
  });
});

describe("inPeriod('month')", () => {
  it("starts on the first, not the last day of the month before", () => {
    vi.useFakeTimers();
    at("2026-07-17T09:33:00Z");
    const month = inPeriod("month");
    expect(month("2026-06-30")).toBe(false); // the old boundary
    expect(month("2026-07-01")).toBe(true);
  });

  it("ends on the last day of the month", () => {
    vi.useFakeTimers();
    at("2026-07-17T09:33:00Z");
    const month = inPeriod("month");
    expect(month("2026-07-31")).toBe(true);
    expect(month("2026-08-01")).toBe(false);
  });

  it("excludes a post-dated row, which is what the dashboard always did", () => {
    // The old month had no upper bound, so a December invoice counted in July's
    // profit on one screen and not the other.
    vi.useFakeTimers();
    at("2026-07-17T09:33:00Z");
    expect(inPeriod("month")("2026-12-25")).toBe(false);
  });

  it("gets February right without being told about it", () => {
    vi.useFakeTimers();
    at("2027-02-10T09:00:00Z");
    const feb = inPeriod("month");
    expect(feb("2027-02-28")).toBe(true);
    expect(feb("2027-03-01")).toBe(false);
  });

  it("gets a leap February right", () => {
    vi.useFakeTimers();
    at("2028-02-10T09:00:00Z");
    const feb = inPeriod("month");
    expect(feb("2028-02-29")).toBe(true);
    expect(feb("2028-03-01")).toBe(false);
  });

  it("holds just after midnight on the first of the month", () => {
    // 00:30 SAST on 1 July: UTC still says 30 June, so the old code moved the
    // whole month back to 31 May.
    vi.useFakeTimers();
    at("2026-06-30T22:30:00Z");
    const month = inPeriod("month");
    expect(month("2026-07-01")).toBe(true);
    expect(month("2026-06-30")).toBe(false);
    expect(month("2026-05-31")).toBe(false);
  });
});

describe("inPeriod('week')", () => {
  it("runs Monday to Sunday, SA convention", () => {
    vi.useFakeTimers();
    at("2026-07-17T09:33:00Z"); // Friday 17 July 2026, 11:33 SAST
    const week = inPeriod("week");
    expect(week("2026-07-13")).toBe(true); // Monday
    expect(week("2026-07-19")).toBe(true); // Sunday
    expect(week("2026-07-12")).toBe(false); // the Sunday before
    expect(week("2026-07-20")).toBe(false); // next Monday
  });

  it("treats Sunday as the end of this week, not the start of the next", () => {
    vi.useFakeTimers();
    at("2026-07-19T09:00:00Z"); // Sunday
    const week = inPeriod("week");
    expect(week("2026-07-13")).toBe(true); // still this week's Monday
    expect(week("2026-07-19")).toBe(true);
    expect(week("2026-07-20")).toBe(false);
  });
});

describe("inPeriod('year')", () => {
  it("runs 1 January to 31 December, excluding either side", () => {
    vi.useFakeTimers();
    at("2026-07-17T09:33:00Z");
    const year = inPeriod("year");
    expect(year("2026-01-01")).toBe(true);
    expect(year("2026-12-31")).toBe(true);
    expect(year("2025-12-31")).toBe(false);
    expect(year("2027-01-01")).toBe(false);
  });

  it("keeps a month that the month view drops — the whole reason the toggle exists", () => {
    // April is in this year but not in July. The dashboard's Month view hides an
    // April invoice; Year keeps it. This is the multi-month contractor case.
    vi.useFakeTimers();
    at("2026-07-17T09:33:00Z");
    expect(inPeriod("month")("2026-04-15")).toBe(false);
    expect(inPeriod("year")("2026-04-15")).toBe(true);
  });

  it("holds just after midnight on 1 January", () => {
    // 00:30 SAST on 1 Jan is still 31 Dec in UTC — the boundary the day-shift bug
    // would have pulled back into the previous year.
    vi.useFakeTimers();
    at("2025-12-31T22:30:00Z"); // 00:30 SAST on 1 Jan 2026
    const year = inPeriod("year");
    expect(year("2026-01-01")).toBe(true);
    expect(year("2025-12-31")).toBe(false);
  });
});

describe("inPeriod('all')", () => {
  it("takes everything, including dates either side of now", () => {
    vi.useFakeTimers();
    at("2026-07-17T09:33:00Z");
    const all = inPeriod("all");
    expect(all("1999-01-01")).toBe(true);
    expect(all("2099-12-31")).toBe(true);
  });
});
