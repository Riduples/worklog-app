import { describe, expect, it } from "vitest";
import {
  TAX_RATES,
  calcMedicalCredit,
  calcMonthlyPAYE,
  calcPAYE,
  calcRebate,
  calcUIF,
  incomeNet,
  vatFromGross,
} from "./taxRates";

// Tests against published SARS 2025/26 figures, as the build spec asks for
// (§6: "Write unit tests against known SARS 2025/26 figures").
//
// These are deliberately written against externally-checkable numbers — SARS
// tax thresholds, the UIF maximum, bracket continuity — rather than against
// whatever the code currently returns. A test that just records today's output
// would pass just as happily on a wrong answer, and every payroll bug found in
// this project so far (SDL hardcoded to zero, UIF ignoring the ceiling, PAYE
// threshold as a literal) would have sailed through one.
//
// The calculations are imported directly rather than through useTaxRates():
// calling a use*-prefixed function outside a component breaks rules-of-hooks,
// and a tax module worth testing shouldn't need a React wrapper to be reached.

describe("rate constants match SARS 2025/26", () => {
  it("carries the published rates", () => {
    expect(TAX_RATES.VAT_RATE).toBe(0.15);
    expect(TAX_RATES.UIF_EMPLOYEE_RATE).toBe(0.01);
    expect(TAX_RATES.UIF_EMPLOYER_RATE).toBe(0.01);
    expect(TAX_RATES.UIF_CEILING).toBe(17712);
    expect(TAX_RATES.SDL_RATE).toBe(0.01);
    expect(TAX_RATES.PRIMARY_REBATE).toBe(17235);
    expect(TAX_RATES.SECONDARY_REBATE).toBe(9444);
    expect(TAX_RATES.TERTIARY_REBATE).toBe(3145);
    expect(TAX_RATES.SDL_ANNUAL_THRESHOLD).toBe(500_000);
    expect(TAX_RATES.PAYE_MONTHLY_THRESHOLD).toBe(7979);
    expect(TAX_RATES.MEDICAL_CREDIT_FIRST_TWO).toBe(364);
    expect(TAX_RATES.MEDICAL_CREDIT_ADDITIONAL).toBe(246);
    expect(TAX_RATES.COMPANY_TAX_RATE).toBe(0.27);
    expect(TAX_RATES.MILEAGE_RATE).toBe(4.84);
    expect(TAX_RATES.TAX_YEAR).toBe("2025/26");
  });
});

describe("calcPAYE — annual tax before rebates", () => {
  it("taxes the first bracket at a flat 18%", () => {
    expect(calcPAYE(100_000)).toBeCloseTo(18_000, 2);
  });

  it("matches a hand-worked second-bracket case", () => {
    // R276,000: 42,678 + (276,000 − 237,100) × 26% = 42,678 + 10,114 = 52,792
    expect(calcPAYE(276_000)).toBeCloseTo(52_792, 2);
  });

  it("matches a hand-worked top-bracket case", () => {
    // R2,000,000: 644,489 + (2,000,000 − 1,817,000) × 45%
    //           = 644,489 + 82,350 = 726,839
    expect(calcPAYE(2_000_000)).toBeCloseTo(726_839, 2);
  });

  it("is continuous across every bracket edge", () => {
    // At the exact start of a bracket, the tax must equal that bracket's base —
    // otherwise earning one rand more would jump the bill. This catches a
    // mistyped base or an off-by-one in the > / >= comparison.
    const edges: [number, number][] = [
      [237_100, 42_678],
      [370_500, 77_362],
      [512_800, 121_475],
      [673_000, 179_147],
      [857_900, 251_258],
      [1_817_000, 644_489],
    ];
    for (const [income, expected] of edges) {
      expect(calcPAYE(income)).toBeCloseTo(expected, 2);
    }
  });

  it("never taxes zero or negative income", () => {
    expect(calcPAYE(0)).toBe(0);
    expect(calcPAYE(-5000)).toBe(0);
  });
});

describe("SARS tax thresholds fall out of the rebate", () => {
  // SARS publishes the under-65 threshold as R95,750 for 2025/26. It isn't a
  // separate constant — it's the income at which 18% exactly cancels the
  // primary rebate. If the rebate and the threshold ever disagree, one of them
  // is wrong, and this is what says so.
  it("puts the under-65 threshold at R95,750", () => {
    expect(TAX_RATES.PRIMARY_REBATE / 0.18).toBeCloseTo(95_750, 0);
  });

  it("agrees with the monthly PAYE threshold", () => {
    // R95,750 / 12 = R7,979.17, which is where PAYE_MONTHLY_THRESHOLD comes from.
    expect(95_750 / 12).toBeCloseTo(TAX_RATES.PAYE_MONTHLY_THRESHOLD, 0);
  });

  it("charges no tax at the annual threshold", () => {
    expect(Math.max(0, calcPAYE(95_750) - TAX_RATES.PRIMARY_REBATE)).toBeCloseTo(0, 0);
  });
});

describe("calcRebate — age-based, and they stack", () => {
  it("gives the primary rebate under 65", () => {
    expect(calcRebate("under65")).toBe(17_235);
    expect(calcRebate()).toBe(17_235); // defaults to under 65
  });

  it("adds the secondary rebate from 65", () => {
    expect(calcRebate("65to74")).toBe(17_235 + 9_444);
  });

  it("adds the tertiary rebate too from 75", () => {
    // All three stack — a 76-year-old gets R29,824, not just the tertiary.
    expect(calcRebate("75plus")).toBe(17_235 + 9_444 + 3_145);
  });

  it("reproduces every SARS tax threshold", () => {
    // SARS publishes these for 2025/26: R95,750 under 65, R148,217 at 65–74,
    // R165,689 at 75+. Each is its total rebate ÷ 18%. Deriving them is what
    // makes a typo in any single rebate impossible to miss.
    expect(calcRebate("under65") / 0.18).toBeCloseTo(95_750, 0);
    expect(calcRebate("65to74") / 0.18).toBeCloseTo(148_217, 0);
    expect(calcRebate("75plus") / 0.18).toBeCloseTo(165_689, 0);
  });

  it("is worth R9,444 a year to a 65-year-old", () => {
    // The bug this guards: ProvTax applied only the primary rebate, so anyone
    // over 65 was told they owed R9,444 more than they do.
    expect(calcRebate("65to74") - calcRebate("under65")).toBe(9_444);
    expect(calcRebate("75plus") - calcRebate("under65")).toBe(12_589);
  });
});

describe("calcMonthlyPAYE", () => {
  it("is zero at and below the monthly threshold", () => {
    expect(calcMonthlyPAYE(5_000)).toBe(0);
    expect(calcMonthlyPAYE(TAX_RATES.PAYE_MONTHLY_THRESHOLD)).toBe(0);
  });

  it("only just starts charging above the threshold", () => {
    // A rand over the threshold must produce a near-zero bill, not a cliff.
    const justOver = calcMonthlyPAYE(TAX_RATES.PAYE_MONTHLY_THRESHOLD + 1);
    expect(justOver).toBeGreaterThan(0);
    expect(justOver).toBeLessThan(5);
  });

  it("matches a hand-worked case", () => {
    // R23,000/month = R276,000/year → 52,792 − 17,235 = 35,557 → /12 = 2,963.08
    expect(calcMonthlyPAYE(23_000)).toBeCloseTo(2_963.08, 2);
  });

  it("splits the monthly figure for weekly and fortnightly pay", () => {
    const monthly = calcMonthlyPAYE(23_000, "Monthly");
    expect(calcMonthlyPAYE(23_000, "Weekly")).toBeCloseTo(monthly / 4.33, 2);
    expect(calcMonthlyPAYE(23_000, "Fortnightly")).toBeCloseTo(monthly / 2.17, 2);
  });

  it("never returns a negative", () => {
    expect(calcMonthlyPAYE(8_000)).toBeGreaterThanOrEqual(0);
  });
});

describe("calcUIF", () => {
  it("takes 1% from each side below the ceiling", () => {
    expect(calcUIF(5_000)).toEqual({ employee: 50, employer: 50, total: 100 });
  });

  it("caps at the monthly ceiling", () => {
    // The bug this guards: StaffModal previewed 2% of the full wage, so an
    // employee on R25,000 was quoted R500/month against Pay Run's R354.24.
    const capped = calcUIF(25_000);
    expect(capped.employee).toBeCloseTo(177.12, 2);
    expect(capped.employer).toBeCloseTo(177.12, 2);
    expect(capped.total).toBeCloseTo(354.24, 2);
  });

  it("treats the ceiling itself as uncapped", () => {
    expect(calcUIF(TAX_RATES.UIF_CEILING).total).toBeCloseTo(354.24, 2);
  });

  it("applies from the first rand — there is no earnings threshold", () => {
    // UIF is not PAYE: it starts immediately. The help assistant got this
    // wrong once by borrowing the PAYE threshold.
    expect(calcUIF(100).total).toBeCloseTo(2, 2);
  });

  it("is zero for zero wages", () => {
    expect(calcUIF(0)).toEqual({ employee: 0, employer: 0, total: 0 });
  });
});

describe("calcMedicalCredit — annual", () => {
  it("gives the flat rate for the first two members", () => {
    expect(calcMedicalCredit(1)).toBe(364 * 12);
    expect(calcMedicalCredit(2)).toBe(2 * 364 * 12);
  });

  it("drops to the lower rate from the third member", () => {
    // (2 × 364 + 246) × 12 = 974 × 12 = 11,688
    expect(calcMedicalCredit(3)).toBe(11_688);
    // (2 × 364 + 2 × 246) × 12 = 1,220 × 12 = 14,640
    expect(calcMedicalCredit(4)).toBe(14_640);
  });

  it("is zero with no members", () => {
    expect(calcMedicalCredit(0)).toBe(0);
    expect(calcMedicalCredit(-1)).toBe(0);
  });
});

describe("VAT extraction from a gross amount", () => {
  it("takes the VAT out of the amount, not off the top", () => {
    // R1,150 received at 15% holds R150 of VAT (1150 × 15/115).
    // The wrong answer — 1150 × 15% = R172.50 — is what a naive port gives.
    expect(vatFromGross(1_150, 0.15)).toBeCloseTo(150, 2);
    expect(vatFromGross(1_150, 0.15)).not.toBeCloseTo(172.5, 2);
  });

  it("round-trips against adding VAT on top", () => {
    // An invoice builds up: 2,000 ex-VAT + 300 VAT = 2,300 gross.
    // Income observes the 2,300 and must recover exactly the same 300.
    const exVat = 2_000;
    const gross = exVat * 1.15;
    expect(vatFromGross(gross, 0.15)).toBeCloseTo(300, 2);
    // The production ex-VAT recovery (incomeNet) must return exactly the subtotal.
    expect(incomeNet({ amount: gross, vat_amount: vatFromGross(gross, 0.15) })).toBeCloseTo(exVat, 2);
  });

  it("is zero when not VAT registered or nothing received", () => {
    expect(vatFromGross(1_150, 0)).toBe(0);
    expect(vatFromGross(0, 0.15)).toBe(0);
  });
});

describe("incomeNet", () => {
  it("subtracts the row's own VAT snapshot", () => {
    expect(incomeNet({ amount: 1_150, vat_amount: 150 })).toBe(1_000);
  });

  it("treats a pre-VAT row as fully net", () => {
    // Every row written before VAT support has vat_amount 0 / null. Those must
    // keep meaning exactly what they meant, or Profit & Loss shifts under
    // historical data.
    expect(incomeNet({ amount: 500, vat_amount: 0 })).toBe(500);
    expect(incomeNet({ amount: 500, vat_amount: null })).toBe(500);
    expect(incomeNet({ amount: 500 })).toBe(500);
  });

  it("copes with numerics arriving as strings", () => {
    // Postgres NUMERIC comes back over the wire as a string.
    expect(incomeNet({ amount: "1150.00", vat_amount: "150.00" })).toBe(1_000);
  });
});
