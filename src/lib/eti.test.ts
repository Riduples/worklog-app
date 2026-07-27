import { describe, expect, it } from "vitest";
import { calcETI, monthsEmployedFrom, type EtiResult } from "./eti";

// A 26-year-old employee as at the reference date (born 2000-01-01), with a valid
// SA ID on record. asOf is passed so the age — and therefore the band math — is
// stable regardless of when the suite runs.
const ASOF = new Date("2026-07-27");
const emp = (over: Partial<{ date_of_birth: string | null; id_number: string | null; is_contractor: boolean }> = {}) => ({
  date_of_birth: "2000-01-01",
  id_number: "0001015800086",
  is_contractor: false,
  ...over,
});

function amt(r: EtiResult): number | null {
  return r.eligible ? r.amount : null;
}

describe("calcETI — bands effective 1 April 2025", () => {
  it("first year, under R2,500: 60% of remuneration", () => {
    expect(amt(calcETI(emp(), 2000, 3, ASOF))).toBe(1200);
  });
  it("first year, R2,500–R5,500: flat R2,500", () => {
    expect(amt(calcETI(emp(), 4000, 3, ASOF))).toBe(2500);
  });
  it("first year, R5,500–R7,500: tapers from R2,500 to R0", () => {
    // 2500 − 1.25 × (6500 − 5500) = 2500 − 1250 = 1250
    expect(amt(calcETI(emp(), 6500, 3, ASOF))).toBe(1250);
  });
  it("second year (>=12 months) halves the incentive", () => {
    expect(amt(calcETI(emp(), 2000, 12, ASOF))).toBe(600); // 30% of 2000
    expect(amt(calcETI(emp(), 4000, 18, ASOF))).toBe(1250); // flat second-year
  });

  it("is not eligible at R7,500 or above (ceiling)", () => {
    expect(calcETI(emp(), 7500, 3, ASOF).eligible).toBe(false);
  });
  it("is not eligible outside 18–29", () => {
    expect(calcETI(emp({ date_of_birth: "1980-01-01" }), 4000, 3, ASOF).eligible).toBe(false);
  });
  it("is not eligible for contractors", () => {
    expect(calcETI(emp({ is_contractor: true }), 4000, 3, ASOF).eligible).toBe(false);
  });
  it("flags when there is no ID / DOB to check", () => {
    const r = calcETI({ date_of_birth: null, id_number: null, is_contractor: false }, 4000, 3, ASOF);
    expect(r.eligible).toBe(false);
    expect(r.eligible === false && r.needsInfo).toBe(true);
  });
});

describe("monthsEmployedFrom", () => {
  it("counts whole months elapsed", () => {
    expect(monthsEmployedFrom("2026-01-27", new Date("2026-07-27"))).toBe(6);
  });
  it("does not count the current month until the day-of-month is reached", () => {
    expect(monthsEmployedFrom("2026-01-28", new Date("2026-07-27"))).toBe(5);
  });
  it("is zero with no start date", () => {
    expect(monthsEmployedFrom(null)).toBe(0);
  });
});
