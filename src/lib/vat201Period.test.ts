import { describe, expect, it } from "vitest";
import { periodRange } from "@/components/reports/Vat201View";

// The VAT201's period decides which transactions a business declares to SARS.
// It was wrong at both ends for every user of this app and had no test at all.
//
// These run at Africa/Johannesburg (vitest.config.ts). At UTC every one of them
// passes against the broken code, which is exactly how it shipped: the boundary
// was built with new Date(y, m, 1) — local midnight — and then read with
// .toISOString(), which converts to UTC. At offset 0 that's a no-op. At UTC+2
// local midnight is 22:00 the previous day, so both ends moved back a day.
const range = (year: number, startMonth0: number, monthly: boolean) => {
  const r = periodRange(year, startMonth0, monthly);
  return `${r.fromDate}..${r.toDate}`;
};

describe("VAT201 monthly periods", () => {
  it("July 2026 is July, not 30 June to 30 July", () => {
    expect(range(2026, 6, true)).toBe("2026-07-01..2026-07-31");
  });

  it("a 30-day month ends on the 30th", () => {
    expect(range(2026, 3, true)).toBe("2026-04-01..2026-04-30");
  });

  it("February ends on the 28th", () => {
    expect(range(2027, 1, true)).toBe("2027-02-01..2027-02-28");
  });

  it("a leap February ends on the 29th", () => {
    expect(range(2028, 1, true)).toBe("2028-02-01..2028-02-29");
  });

  it("January starts on 1 January, not 31 December of the year before", () => {
    expect(range(2026, 0, true)).toBe("2026-01-01..2026-01-31");
  });

  it("December stays inside its own year", () => {
    expect(range(2026, 11, true)).toBe("2026-12-01..2026-12-31");
  });
});

describe("VAT201 bi-monthly periods (SARS Jan/Feb, Mar/Apr, ... pairs)", () => {
  it("Jan–Feb starts in January, not the previous December", () => {
    // The worst one: this used to return 2025-12-31..2026-02-27, reaching into
    // the previous calendar year.
    expect(range(2026, 0, false)).toBe("2026-01-01..2026-02-28");
  });

  it("Mar–Apr covers both months whole", () => {
    expect(range(2026, 2, false)).toBe("2026-03-01..2026-04-30");
  });

  it("Nov–Dec ends on 31 December", () => {
    expect(range(2026, 10, false)).toBe("2026-11-01..2026-12-31");
  });

  it("Jan–Feb in a leap year ends on the 29th", () => {
    expect(range(2028, 0, false)).toBe("2028-01-01..2028-02-29");
  });
});

describe("the periods tile together", () => {
  // A day belonging to no return, or to two, is a SARS problem either way.
  it("consecutive monthly periods meet with no gap and no overlap", () => {
    for (let m = 0; m < 11; m++) {
      const thisMonth = periodRange(2026, m, true);
      const nextMonth = periodRange(2026, m + 1, true);
      const dayAfterEnd = new Date(thisMonth.toDate);
      dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);
      const expectedNextStart = `${dayAfterEnd.getFullYear()}-${String(dayAfterEnd.getMonth() + 1).padStart(2, "0")}-${String(dayAfterEnd.getDate()).padStart(2, "0")}`;
      expect(nextMonth.fromDate).toBe(expectedNextStart);
    }
  });

  it("labels the period the way the owner would name it", () => {
    expect(periodRange(2026, 6, true).label).toBe("Jul 2026");
    expect(periodRange(2026, 0, false).label).toBe("Jan–Feb 2026");
  });
});
