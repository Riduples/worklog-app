import { describe, expect, it } from "vitest";
import {
  TAX_RATES,
  calcMedicalCredit,
  calcMonthlyPAYE,
  calcPAYE,
  calcSBC,
  calcTurnoverTax,
  calcRebate,
  calcUIF,
  incomeNet,
  vatFromGross,
} from "./taxRates";

// Tests against published SARS 2026/27 figures (the current tax year). The build
// spec (§6) asked for known-SARS-figure tests; the figures move each tax year, so
// these are updated in lockstep with taxRates.ts when the Budget lands.
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

describe("rate constants match SARS 2026/27", () => {
  it("carries the published rates", () => {
    expect(TAX_RATES.VAT_RATE).toBe(0.15);
    expect(TAX_RATES.UIF_EMPLOYEE_RATE).toBe(0.01);
    expect(TAX_RATES.UIF_EMPLOYER_RATE).toBe(0.01);
    expect(TAX_RATES.UIF_CEILING).toBe(17712);
    expect(TAX_RATES.SDL_RATE).toBe(0.01);
    expect(TAX_RATES.PRIMARY_REBATE).toBe(17820);
    expect(TAX_RATES.SECONDARY_REBATE).toBe(9765);
    expect(TAX_RATES.TERTIARY_REBATE).toBe(3249);
    expect(TAX_RATES.SDL_ANNUAL_THRESHOLD).toBe(500_000);
    expect(TAX_RATES.OID_EARNINGS_THRESHOLD).toBe(597_328);
    expect(TAX_RATES.PAYE_MONTHLY_THRESHOLD).toBe(8250);
    expect(TAX_RATES.MEDICAL_CREDIT_FIRST_TWO).toBe(376);
    expect(TAX_RATES.MEDICAL_CREDIT_ADDITIONAL).toBe(254);
    expect(TAX_RATES.COMPANY_TAX_RATE).toBe(0.27);
    expect(TAX_RATES.TRUST_TAX_RATE).toBe(0.45);
    expect(TAX_RATES.TURNOVER_TAX_MAX).toBe(2_300_000);
    expect(TAX_RATES.MILEAGE_RATE).toBe(4.95);
    expect(TAX_RATES.TAX_YEAR).toBe("2026/27");
  });
});

describe("calcPAYE — annual tax before rebates", () => {
  it("taxes the first bracket at a flat 18%", () => {
    expect(calcPAYE(100_000)).toBeCloseTo(18_000, 2);
  });

  it("matches a hand-worked second-bracket case", () => {
    // R276,000: 44,118 + (276,000 − 245,100) × 26% = 44,118 + 8,034 = 52,152
    expect(calcPAYE(276_000)).toBeCloseTo(52_152, 2);
  });

  it("matches a hand-worked top-bracket case", () => {
    // R2,000,000: 666,339 + (2,000,000 − 1,878,600) × 45%
    //           = 666,339 + 54,630 = 720,969
    expect(calcPAYE(2_000_000)).toBeCloseTo(720_969, 2);
  });

  it("is continuous across every bracket edge", () => {
    // At the exact start of a bracket, the tax must equal that bracket's base —
    // otherwise earning one rand more would jump the bill. This catches a
    // mistyped base or an off-by-one in the > / >= comparison.
    const edges: [number, number][] = [
      [245_100, 44_118],
      [383_100, 79_998],
      [530_200, 125_599],
      [695_800, 185_215],
      [887_000, 259_783],
      [1_878_600, 666_339],
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
  // SARS publishes the under-65 threshold as R99,000 for 2026/27. It isn't a
  // separate constant — it's the income at which 18% exactly cancels the
  // primary rebate. If the rebate and the threshold ever disagree, one of them
  // is wrong, and this is what says so.
  it("puts the under-65 threshold at R99,000", () => {
    expect(TAX_RATES.PRIMARY_REBATE / 0.18).toBeCloseTo(99_000, 0);
  });

  it("agrees with the monthly PAYE threshold", () => {
    // R99,000 / 12 = R8,250, which is where PAYE_MONTHLY_THRESHOLD comes from.
    expect(99_000 / 12).toBeCloseTo(TAX_RATES.PAYE_MONTHLY_THRESHOLD, 0);
  });

  it("charges no tax at the annual threshold", () => {
    expect(Math.max(0, calcPAYE(99_000) - TAX_RATES.PRIMARY_REBATE)).toBeCloseTo(0, 0);
  });
});

describe("SBC scale matches SARS 2026/27", () => {
  it("carries the published Small Business Corporation bands", () => {
    expect(TAX_RATES.SBC_BRACKETS).toEqual([
      { from: 0, base: 0, rate: 0 },
      { from: 99_000, base: 0, rate: 0.07 },
      { from: 365_000, base: 18_620, rate: 0.21 },
      { from: 550_000, base: 57_470, rate: 0.27 },
    ]);
  });

  it("derives each base from the band below it", () => {
    // Like PAYE, the cumulative bases aren't independent figures — each is the tax
    // at the top of the previous band. A typo surfaces here before it reaches a
    // return: 7%×(365,000−99,000)=18,620; +21%×(550,000−365,000)=57,470.
    const b = TAX_RATES.SBC_BRACKETS;
    expect(b[2]!.base).toBeCloseTo(b[1]!.base + (b[2]!.from - b[1]!.from) * b[1]!.rate, 2);
    expect(b[3]!.base).toBeCloseTo(b[2]!.base + (b[3]!.from - b[2]!.from) * b[2]!.rate, 2);
  });

  it("starts taxing exactly where the individual threshold ends", () => {
    // The 0% band tops out at the same R99,000 an individual reaches before PAYE
    // bites (PRIMARY_REBATE ÷ 18%). If one moves and the other doesn't, this trips.
    const sbcThreshold = TAX_RATES.SBC_BRACKETS.find((band) => band.rate > 0)?.from;
    expect(sbcThreshold).toBe(99_000);
    expect(TAX_RATES.PRIMARY_REBATE / 0.18).toBeCloseTo(sbcThreshold!, 0);
  });

  it("tops out at the flat company rate", () => {
    // The SBC scale is relief on the way up, not a different ceiling — its highest
    // marginal rate is the same flat rate a non-qualifying company pays throughout.
    const top = TAX_RATES.SBC_BRACKETS[TAX_RATES.SBC_BRACKETS.length - 1]!;
    expect(top.rate).toBe(TAX_RATES.COMPANY_TAX_RATE);
  });
});

describe("calcSBC — annual small-business tax", () => {
  it("charges nothing in the 0% band", () => {
    expect(calcSBC(50_000)).toBe(0);
    expect(calcSBC(99_000)).toBe(0); // the top of the tax-free band
  });

  it("taxes the 7% band on the slice above the threshold", () => {
    // R200,000: (200,000 − 99,000) × 7% = 101,000 × 7% = 7,070
    expect(calcSBC(200_000)).toBeCloseTo(7_070, 2);
  });

  it("matches a hand-worked top-band case", () => {
    // R1,000,000: 57,470 + (1,000,000 − 550,000) × 27% = 57,470 + 121,500 = 178,970
    expect(calcSBC(1_000_000)).toBeCloseTo(178_970, 2);
  });

  it("is continuous across every band edge", () => {
    // At the exact start of a band, tax must equal that band's base — otherwise
    // earning one rand more would jump the bill.
    const edges: [number, number][] = [
      [99_000, 0],
      [365_000, 18_620],
      [550_000, 57_470],
    ];
    for (const [income, expected] of edges) {
      expect(calcSBC(income)).toBeCloseTo(expected, 2);
    }
  });

  it("never taxes zero or negative income", () => {
    expect(calcSBC(0)).toBe(0);
    expect(calcSBC(-5_000)).toBe(0);
  });

  it("relieves a small business well below the flat company rate", () => {
    // The whole point of the feature: on R200,000 profit a qualifying SBC pays
    // R7,070, not the R54,000 a flat-27% company would — a ~R47k difference.
    const flat = 200_000 * TAX_RATES.COMPANY_TAX_RATE;
    expect(calcSBC(200_000)).toBeLessThan(flat);
    expect(flat - calcSBC(200_000)).toBeCloseTo(46_930, 2);
  });
});

describe("Turnover Tax scale matches SARS 2027 year of assessment", () => {
  it("carries the published Sixth Schedule bands (overhauled for 2026/27)", () => {
    expect(TAX_RATES.TURNOVER_TAX_BRACKETS).toEqual([
      { from: 0, base: 0, rate: 0 },
      { from: 600_000, base: 0, rate: 0.01 },
      { from: 950_000, base: 3_500, rate: 0.02 },
      { from: 1_400_000, base: 12_500, rate: 0.03 },
    ]);
  });

  it("derives each base from the band below it", () => {
    // Cumulative bases aren't independent: 1%×(950,000−600,000)=3,500;
    // 3,500+2%×(1,400,000−950,000)=12,500. A typo surfaces here.
    const b = TAX_RATES.TURNOVER_TAX_BRACKETS;
    expect(b[2]!.base).toBeCloseTo(b[1]!.base + (b[2]!.from - b[1]!.from) * b[1]!.rate, 2);
    expect(b[3]!.base).toBeCloseTo(b[2]!.base + (b[3]!.from - b[2]!.from) * b[2]!.rate, 2);
  });

  it("keeps the top band below the qualifying ceiling", () => {
    // A business over the R2.3m ceiling can't be on turnover tax at all, so the
    // top band must start below it.
    const top = TAX_RATES.TURNOVER_TAX_BRACKETS[TAX_RATES.TURNOVER_TAX_BRACKETS.length - 1]!;
    expect(top.from).toBeLessThan(TAX_RATES.TURNOVER_TAX_MAX);
  });
});

describe("calcTurnoverTax — annual tax on turnover", () => {
  it("charges nothing in the tax-free band", () => {
    expect(calcTurnoverTax(300_000)).toBe(0);
    expect(calcTurnoverTax(600_000)).toBe(0); // top of the tax-free band
  });

  it("taxes the 1% band on the slice above R600,000", () => {
    // R800,000: (800,000 − 600,000) × 1% = 2,000
    expect(calcTurnoverTax(800_000)).toBeCloseTo(2_000, 2);
  });

  it("matches a hand-worked top-band case", () => {
    // R2,000,000: 12,500 + (2,000,000 − 1,400,000) × 3% = 12,500 + 18,000 = 30,500
    expect(calcTurnoverTax(2_000_000)).toBeCloseTo(30_500, 2);
  });

  it("is continuous across every band edge", () => {
    const edges: [number, number][] = [
      [600_000, 0],
      [950_000, 3_500],
      [1_400_000, 12_500],
    ];
    for (const [turnover, expected] of edges) {
      expect(calcTurnoverTax(turnover)).toBeCloseTo(expected, 2);
    }
  });

  it("is far lighter than the flat company rate on the same figure", () => {
    // The point of the regime: R800,000 turnover attracts R2,000, well under
    // what a flat 27% would take (though that's on profit, the relief is the idea).
    expect(calcTurnoverTax(800_000)).toBeLessThan(800_000 * TAX_RATES.COMPANY_TAX_RATE);
  });

  it("never taxes zero or negative turnover", () => {
    expect(calcTurnoverTax(0)).toBe(0);
    expect(calcTurnoverTax(-5_000)).toBe(0);
  });
});

describe("calcRebate — age-based, and they stack", () => {
  it("gives the primary rebate under 65", () => {
    expect(calcRebate("under65")).toBe(17_820);
    expect(calcRebate()).toBe(17_820); // defaults to under 65
  });

  it("adds the secondary rebate from 65", () => {
    expect(calcRebate("65to74")).toBe(17_820 + 9_765);
  });

  it("adds the tertiary rebate too from 75", () => {
    // All three stack — a 76-year-old gets R30,834, not just the tertiary.
    expect(calcRebate("75plus")).toBe(17_820 + 9_765 + 3_249);
  });

  it("reproduces every SARS tax threshold", () => {
    // SARS publishes these for 2026/27: R99,000 under 65, R153,250 at 65–74,
    // R171,300 at 75+. Each is its total rebate ÷ 18%. Deriving them is what
    // makes a typo in any single rebate impossible to miss.
    expect(calcRebate("under65") / 0.18).toBeCloseTo(99_000, 0);
    expect(calcRebate("65to74") / 0.18).toBeCloseTo(153_250, 0);
    expect(calcRebate("75plus") / 0.18).toBeCloseTo(171_300, 0);
  });

  it("is worth R9,765 a year to a 65-year-old", () => {
    // The bug this guards: ProvTax applied only the primary rebate, so anyone
    // over 65 was told they owed R9,765 more than they do.
    expect(calcRebate("65to74") - calcRebate("under65")).toBe(9_765);
    expect(calcRebate("75plus") - calcRebate("under65")).toBe(13_014);
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
    // R23,000/month = R276,000/year → 52,152 − 17,820 = 34,332 → /12 = 2,861.00
    expect(calcMonthlyPAYE(23_000)).toBeCloseTo(2_861.0, 2);
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
    expect(calcMedicalCredit(1)).toBe(376 * 12);
    expect(calcMedicalCredit(2)).toBe(2 * 376 * 12);
  });

  it("drops to the lower rate from the third member", () => {
    // (2 × 376 + 254) × 12 = 1,006 × 12 = 12,072
    expect(calcMedicalCredit(3)).toBe(12_072);
    // (2 × 376 + 2 × 254) × 12 = 1,260 × 12 = 15,120
    expect(calcMedicalCredit(4)).toBe(15_120);
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
