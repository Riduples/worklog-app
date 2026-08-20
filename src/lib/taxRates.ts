import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { todayStr } from "@/lib/format";
import type { Tables } from "@/lib/types/database";

// The full set of SARS rate constants the app calculates against. At runtime these
// come from the tax_rates table (admin-editable, one row per tax year — migration
// 0075), selected by effective date. The hardcoded values below are the FALLBACK:
// the app uses them until the table loads, if it's unreachable, and for server
// code / tests that run without the DB. Keep the fallback in step with the table's
// current-year row so it can never be wrong.

type PayeBracket = { from: number; base: number; rate: number };

export type TaxRateSet = {
  VAT_RATE: number;
  MILEAGE_RATE: number;
  TAX_JAR_RATE: number;
  UIF_EMPLOYEE_RATE: number;
  UIF_EMPLOYER_RATE: number;
  UIF_CEILING: number;
  SDL_RATE: number;
  SDL_ANNUAL_THRESHOLD: number;
  // COIDA / OID maximum assessable earnings per employee per year — the ceiling
  // the annual Return of Earnings caps each worker's earnings at. A Department of
  // Employment & Labour figure, gazetted yearly.
  OID_EARNINGS_THRESHOLD: number;
  PAYE_MONTHLY_THRESHOLD: number;
  PRIMARY_REBATE: number;
  SECONDARY_REBATE: number;
  TERTIARY_REBATE: number;
  COMPANY_TAX_RATE: number;
  // Flat rate a trust pays on its taxable income (special trusts aside, which are
  // taxed on the individual scale). No rebates apply.
  TRUST_TAX_RATE: number;
  MEDICAL_CREDIT_FIRST_TWO: number;
  MEDICAL_CREDIT_ADDITIONAL: number;
  PAYE_BRACKETS: PayeBracket[];
  // SARS Small Business Corporation sliding scale. Same {from,base,rate} shape as
  // PAYE_BRACKETS — a qualifying small company is taxed on this instead of the flat
  // COMPANY_TAX_RATE, so it lives here alongside the other bands.
  SBC_BRACKETS: PayeBracket[];
  // SARS Turnover Tax (Sixth Schedule) sliding scale for micro businesses,
  // levied on TAXABLE TURNOVER (receipts) rather than profit. Same {from,base,rate}
  // shape. A business only qualifies below TURNOVER_TAX_MAX.
  TURNOVER_TAX_BRACKETS: PayeBracket[];
  // The maximum qualifying annual turnover to be on the Turnover Tax system.
  TURNOVER_TAX_MAX: number;
  TAX_YEAR: string;
};

// Fallback = SARS 2026/27 (1 March 2026 – 28 Feb 2027), verified against SARS's
// published tables. The published tax thresholds fall straight out of the rebates
// — 17,820/0.18 = R99,000 under 65, (17,820+9,765)/0.18 = R153,250 at 65-74,
// (17,820+9,765+3,249)/0.18 = R171,300 at 75+ — which taxRates.test.ts asserts, so
// a typo here can't pass quietly. Update at Budget time each year, keeping this and
// the tax_rates table's current row in step.
export const TAX_RATES: TaxRateSet = {
  VAT_RATE: 0.15,
  MILEAGE_RATE: 4.95,
  TAX_JAR_RATE: 0.28,
  UIF_EMPLOYEE_RATE: 0.01,
  UIF_EMPLOYER_RATE: 0.01,
  UIF_CEILING: 17712,
  SDL_RATE: 0.01,
  SDL_ANNUAL_THRESHOLD: 500000,
  // OID max assessable earnings — R597,328 was gazetted for the 1 Mar 2024–28 Feb
  // 2025 assessment year. Update at Gazette time each year, in step with the
  // tax_rates table's current row.
  OID_EARNINGS_THRESHOLD: 597328,
  PAYE_MONTHLY_THRESHOLD: 8250, // R99,000 under-65 threshold ÷ 12
  PRIMARY_REBATE: 17820,
  SECONDARY_REBATE: 9765,
  TERTIARY_REBATE: 3249,
  COMPANY_TAX_RATE: 0.27,
  TRUST_TAX_RATE: 0.45,
  MEDICAL_CREDIT_FIRST_TWO: 376,
  MEDICAL_CREDIT_ADDITIONAL: 254,
  PAYE_BRACKETS: [
    { from: 0, base: 0, rate: 0.18 },
    { from: 245100, base: 44118, rate: 0.26 },
    { from: 383100, base: 79998, rate: 0.31 },
    { from: 530200, base: 125599, rate: 0.36 },
    { from: 695800, base: 185215, rate: 0.39 },
    { from: 887000, base: 259783, rate: 0.41 },
    { from: 1878600, base: 666339, rate: 0.45 },
  ],
  // SARS Small Business Corporation table for the 2027 year of assessment (years
  // ending 1 Mar 2026 – 28 Feb 2027), verified against SARS's published SBC rates.
  // Like PAYE, the bases fall out of the band widths — 7%×(365,000−99,000)=18,620
  // and 18,620+21%×(550,000−365,000)=57,470 — which taxRates.test.ts asserts, and
  // the 0% band tops out at R99,000, the same figure as the individual tax
  // threshold (PRIMARY_REBATE ÷ 0.18). A qualifying SBC pays this in place of the
  // flat 27%. Update at Budget time in step with the tax_rates table's row.
  SBC_BRACKETS: [
    { from: 0, base: 0, rate: 0 },
    { from: 99000, base: 0, rate: 0.07 },
    { from: 365000, base: 18620, rate: 0.21 },
    { from: 550000, base: 57470, rate: 0.27 },
  ],
  // SARS Turnover Tax table for the 2027 year of assessment — the first change to
  // this regime since 2009. The tax-free band rose to R600,000 and the qualifying
  // ceiling to R2.3m (effective 1 March 2026 for individuals, 1 April 2026 for
  // companies). Levied on taxable turnover, not profit. Like the other tables the
  // cumulative bases fall out of the band widths — 1%×(950,000−600,000)=3,500 and
  // 3,500+2%×(1,400,000−950,000)=12,500 — which taxRates.test.ts asserts.
  TURNOVER_TAX_BRACKETS: [
    { from: 0, base: 0, rate: 0 },
    { from: 600000, base: 0, rate: 0.01 },
    { from: 950000, base: 3500, rate: 0.02 },
    { from: 1400000, base: 12500, rate: 0.03 },
  ],
  TURNOVER_TAX_MAX: 2300000,
  TAX_YEAR: "2026/27",
};

// Parse a JSONB bracket list from a tax_rates row into a validated, ascending
// PayeBracket[]. calcPAYE/calcSBC scan brackets from the top down and assume
// ascending order, so a mis-ordered or blank band (e.g. a trailing {from:0})
// would zero everyone's tax. Require every band finite, sort ascending, and fall
// back to the known-good hardcoded brackets if anything is off — never silently
// compute R0 tax off a malformed row.
function resolveBrackets(raw: unknown, fallback: PayeBracket[]): PayeBracket[] {
  const parsed: PayeBracket[] = Array.isArray(raw)
    ? (raw as unknown[]).map((b) => {
        const o = (b ?? {}) as Record<string, unknown>;
        return { from: Number(o.from), base: Number(o.base), rate: Number(o.rate) };
      })
    : [];
  const valid =
    parsed.length > 0 && parsed.every((b) => Number.isFinite(b.from) && Number.isFinite(b.base) && Number.isFinite(b.rate));
  return valid ? [...parsed].sort((a, b) => a.from - b.from) : fallback;
}

// Map a tax_rates row to a TaxRateSet, or fall back to the hardcoded set when there
// is no row. Postgres NUMERIC arrives over the wire as a string, so coerce every
// figure; a malformed/empty bracket list falls back rather than breaking payroll.
function resolveTaxRates(row: Tables<"tax_rates"> | null | undefined): TaxRateSet {
  if (!row) return TAX_RATES;
  const num = (v: unknown) => Number(v);
  return {
    VAT_RATE: num(row.vat_rate),
    MILEAGE_RATE: num(row.mileage_rate),
    TAX_JAR_RATE: num(row.tax_jar_rate),
    UIF_EMPLOYEE_RATE: num(row.uif_employee_rate),
    UIF_EMPLOYER_RATE: num(row.uif_employer_rate),
    UIF_CEILING: num(row.uif_ceiling),
    SDL_RATE: num(row.sdl_rate),
    SDL_ANNUAL_THRESHOLD: num(row.sdl_annual_threshold),
    // Added after the table shipped (migration 0119) — a row written before then
    // has it null, so fall back to the known-good figure rather than coercing null
    // to 0 and capping every employee's earnings at zero.
    OID_EARNINGS_THRESHOLD: row.oid_earnings_threshold != null ? num(row.oid_earnings_threshold) : TAX_RATES.OID_EARNINGS_THRESHOLD,
    PAYE_MONTHLY_THRESHOLD: num(row.paye_monthly_threshold),
    PRIMARY_REBATE: num(row.primary_rebate),
    SECONDARY_REBATE: num(row.secondary_rebate),
    TERTIARY_REBATE: num(row.tertiary_rebate),
    COMPANY_TAX_RATE: num(row.company_tax_rate),
    // Columns added after the table shipped (migration 0107) — a row written
    // before then has them null, so fall back to the known-good hardcoded value
    // rather than coercing null to 0 and taxing a trust at 0% / breaking turnover tax.
    TRUST_TAX_RATE: row.trust_tax_rate != null ? num(row.trust_tax_rate) : TAX_RATES.TRUST_TAX_RATE,
    MEDICAL_CREDIT_FIRST_TWO: num(row.medical_credit_first_two),
    MEDICAL_CREDIT_ADDITIONAL: num(row.medical_credit_additional),
    PAYE_BRACKETS: resolveBrackets(row.paye_brackets, TAX_RATES.PAYE_BRACKETS),
    SBC_BRACKETS: resolveBrackets(row.sbc_brackets, TAX_RATES.SBC_BRACKETS),
    TURNOVER_TAX_BRACKETS: resolveBrackets(row.turnover_tax_brackets, TAX_RATES.TURNOVER_TAX_BRACKETS),
    TURNOVER_TAX_MAX: row.turnover_tax_max != null ? num(row.turnover_tax_max) : TAX_RATES.TURNOVER_TAX_MAX,
    TAX_YEAR: row.tax_year,
  };
}

// The VAT contained *within* an amount already received, as opposed to VAT
// added on top of a subtotal.
//
// Documents are built up: invoice_amount is ex-VAT and VAT is added, so
// vat = subtotal * rate. Cash income is observed the other way round -- the
// user types what landed in their hand, and the bank-statement import supplies
// the actual transaction amount, neither of which can know an ex-VAT figure.
// So the VAT has to be extracted back out: R1,150 gross at 15% holds R150 VAT
// (1150 * 15/115), not R172.50 (1150 * 15%).
function vatFromGross(gross: number, rate: number): number {
  if (!gross || !rate) return 0;
  return gross * (rate / (1 + rate));
}

// Walk a bracket table from the top down: the first band whose floor the income
// clears gives base + marginal rate on the excess. Shared by PAYE and SBC, which
// are the same arithmetic over different bands.
function taxFromBrackets(income: number, brackets: PayeBracket[]): number {
  if (income <= 0) return 0;
  for (let i = brackets.length - 1; i >= 0; i--) {
    const b = brackets[i];
    if (b && income > b.from) {
      return b.base + (income - b.from) * b.rate;
    }
  }
  return 0;
}

function calcPAYE(annualIncome: number, rates: TaxRateSet = TAX_RATES): number {
  return taxFromBrackets(annualIncome, rates.PAYE_BRACKETS);
}

// Annual income tax for a qualifying Small Business Corporation. Unlike a standard
// company (flat COMPANY_TAX_RATE), an SBC pays on a sliding scale whose 0% band
// leaves the first slice untaxed — so no rebate is applied on top, the scale
// already builds the relief in. Eligibility (turnover ≤ R20m, natural-person
// shareholders, not a personal-service or investment entity) is the caller's to
// assert; this just applies the scale.
function calcSBC(taxableIncome: number, rates: TaxRateSet = TAX_RATES): number {
  return taxFromBrackets(taxableIncome, rates.SBC_BRACKETS);
}

// Annual Turnover Tax for a micro business on the Sixth Schedule. Unlike every
// other calc here it is levied on TAXABLE TURNOVER (receipts), not profit, and
// replaces income tax, provisional tax, CGT and dividends tax entirely — so no
// rebate, deduction or credit is applied on top. Eligibility (turnover ≤
// TURNOVER_TAX_MAX, and the qualifying-business tests) is the caller's to assert.
function calcTurnoverTax(taxableTurnover: number, rates: TaxRateSet = TAX_RATES): number {
  return taxFromBrackets(taxableTurnover, rates.TURNOVER_TAX_BRACKETS);
}

// Monthly PAYE for a given gross, assuming the same amount every month all year.
function calcMonthlyPAYE(
  monthlyGross: number,
  payPeriod: "Weekly" | "Fortnightly" | "Monthly" = "Monthly",
  rates: TaxRateSet = TAX_RATES
): number {
  if (monthlyGross <= rates.PAYE_MONTHLY_THRESHOLD) return 0;
  const annualTax = Math.max(0, calcPAYE(monthlyGross * 12, rates) - rates.PRIMARY_REBATE);
  const monthly = annualTax / 12;
  if (payPeriod === "Weekly") return monthly / 4.33;
  if (payPeriod === "Fortnightly") return monthly / 2.17;
  return monthly;
}

/** The age bands SARS rebates step at. */
export type AgeBand = "under65" | "65to74" | "75plus";

export const AGE_BANDS: { id: AgeBand; label: string }[] = [
  { id: "under65", label: "Under 65" },
  { id: "65to74", label: "65 – 74" },
  { id: "75plus", label: "75 or older" },
];

/**
 * Total annual rebate for an individual. The rebates stack, so someone over 75
 * receives all three.
 *
 * Only individuals get rebates — a company pays a flat rate with none, which is
 * why the caller decides whether to apply this at all.
 */
function calcRebate(ageBand: AgeBand = "under65", rates: TaxRateSet = TAX_RATES): number {
  let total = rates.PRIMARY_REBATE;
  if (ageBand === "65to74" || ageBand === "75plus") total += rates.SECONDARY_REBATE;
  if (ageBand === "75plus") total += rates.TERTIARY_REBATE;
  return total;
}

function calcUIF(grossWages: number, rates: TaxRateSet = TAX_RATES): { employee: number; employer: number; total: number } {
  const base = Math.min(grossWages, rates.UIF_CEILING);
  return {
    employee: base * rates.UIF_EMPLOYEE_RATE,
    employer: base * rates.UIF_EMPLOYER_RATE,
    total: base * (rates.UIF_EMPLOYEE_RATE + rates.UIF_EMPLOYER_RATE),
  };
}

// Annual medical tax credit: a flat amount for each of the first two members,
// a lower amount for every member after that.
function calcMedicalCredit(members: number, rates: TaxRateSet = TAX_RATES): number {
  if (members <= 0) return 0;
  const monthly =
    members <= 2
      ? members * rates.MEDICAL_CREDIT_FIRST_TWO
      : 2 * rates.MEDICAL_CREDIT_FIRST_TWO + (members - 2) * rates.MEDICAL_CREDIT_ADDITIONAL;
  return monthly * 12;
}

// The calculations are plain functions and are exported as such — server code and
// tests can call them directly (default rates = the hardcoded fallback), and a
// component gets rate-bound versions from useTaxRates() below.
export { calcPAYE, calcSBC, calcTurnoverTax, calcMonthlyPAYE, calcUIF, calcMedicalCredit, calcRebate };

// useTaxRates — the component-facing convenience. Reads the current tax year's
// rates from the tax_rates table (cached; falls back to the hardcoded set until it
// loads or if it's unreachable) and returns them alongside calc helpers bound to
// those rates. A real hook now — only call it inside client components.
export function useTaxRates() {
  const supabase = createClient();
  const { data } = useQuery({
    queryKey: ["tax-rates"],
    queryFn: async (): Promise<Tables<"tax_rates"> | null> => {
      // The row whose range COVERS today. Same predicate the stale nudge uses, so
      // when no row covers today (a new tax year with no figures entered yet) this
      // returns null and resolveTaxRates falls through to the hardcoded fallback —
      // rather than silently computing off an expired prior-year row.
      const today = todayStr();
      const { data, error } = await supabase
        .from("tax_rates")
        .select("*")
        .lte("effective_from", today)
        .gte("effective_to", today)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 60 * 1000, // rates change once a year
  });
  const rates = resolveTaxRates(data);
  return {
    ...rates,
    calcPAYE: (annualIncome: number) => calcPAYE(annualIncome, rates),
    calcSBC: (taxableIncome: number) => calcSBC(taxableIncome, rates),
    calcTurnoverTax: (taxableTurnover: number) => calcTurnoverTax(taxableTurnover, rates),
    calcMonthlyPAYE: (monthlyGross: number, payPeriod?: "Weekly" | "Fortnightly" | "Monthly") =>
      calcMonthlyPAYE(monthlyGross, payPeriod, rates),
    calcUIF: (grossWages: number) => calcUIF(grossWages, rates),
    calcMedicalCredit: (members: number) => calcMedicalCredit(members, rates),
    calcRebate: (ageBand?: AgeBand) => calcRebate(ageBand, rates),
    vatFromGross,
  };
}

/**
 * The tax_rates row whose range covers `dateStr`, or null when none does.
 *
 * Pure, so the boundary behaviour can be tested without a database. Ranges are
 * inclusive at both ends, matching the `lte/gte` predicate useTaxRates uses, and
 * YYYY-MM-DD strings compare lexicographically so no Date parsing is involved.
 */
export function pickRateRow(
  rows: Tables<"tax_rates">[] | null | undefined,
  dateStr: string
): Tables<"tax_rates"> | null {
  return (rows ?? []).find((r) => r.effective_from <= dateStr && dateStr <= r.effective_to) ?? null;
}

/**
 * Rates as they stood on a given date, rather than as they stand today.
 *
 * useTaxRates() answers "what applies now", which is right for capturing money
 * — an invoice raised today uses today's VAT rate. It is wrong for a screen that
 * steps through past years: the COIDA Return of Earnings caps each employee at a
 * figure gazetted per assessment year, so viewing 2025/26 with the 2026/27 cap
 * quietly reports the wrong number on something being filed.
 *
 * Every row is fetched once and the covering one picked here, so stepping a year
 * costs no round trip and the caller can tell "that year's figure" from "no
 * figures on file" — which is the distinction the screen has to be honest about.
 * `hasRowForDate` is false when nothing covers the date, and the rates fall back
 * to the hardcoded set exactly as they do when the table is unreachable.
 */
export function useTaxRatesFor(dateStr: string) {
  const supabase = createClient();
  const { data } = useQuery({
    queryKey: ["tax-rates", "all"],
    queryFn: async (): Promise<Tables<"tax_rates">[]> => {
      const { data, error } = await supabase
        .from("tax_rates")
        .select("*")
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Tables<"tax_rates">[];
    },
    staleTime: 60 * 60 * 1000, // rates change once a year
  });
  const row = pickRateRow(data, dateStr);
  return { ...resolveTaxRates(row), hasRowForDate: !!row };
}

// Reports read income rows straight from the database rather than through the
// hook, so expose the same arithmetic as plain functions. vat_amount is a
// snapshot: a row keeps the VAT worked out at the rate that applied when it was
// logged, so never re-derive it from the current rate here.
export { vatFromGross };

/** Net (ex-VAT) revenue in a cash income row. Pre-VAT rows have vat_amount 0. */
export function incomeNet(row: { amount: number | string; vat_amount?: number | string | null }): number {
  return Number(row.amount) - Number(row.vat_amount ?? 0);
}

/**
 * Net (ex-VAT) cost in a cash expense row.
 *
 * The same arithmetic as incomeNet, and needed for the same reason: a purchase
 * is recorded gross, but the VAT inside it is money reclaimed from SARS, not a
 * cost the business bore. Profit & Loss reads costs ex-VAT everywhere else — a
 * supplier invoice contributes its ex-VAT amount — so a cash purchase has to
 * come through here or a VAT-registered business overstates its costs by the
 * VAT on everything it did not happen to receive an invoice for.
 *
 * Every expense logged before VAT capture existed holds vat_amount 0, so this
 * returns the gross amount for them — exactly what they claimed before.
 */
export function expenseNet(row: { amount: number | string; vat_amount?: number | string | null }): number {
  return Number(row.amount) - Number(row.vat_amount ?? 0);
}
