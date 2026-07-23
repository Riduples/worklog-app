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

export type PayeBracket = { from: number; base: number; rate: number };

export type TaxRateSet = {
  VAT_RATE: number;
  MILEAGE_RATE: number;
  TAX_JAR_RATE: number;
  UIF_EMPLOYEE_RATE: number;
  UIF_EMPLOYER_RATE: number;
  UIF_CEILING: number;
  SDL_RATE: number;
  SDL_ANNUAL_THRESHOLD: number;
  PAYE_MONTHLY_THRESHOLD: number;
  PRIMARY_REBATE: number;
  SECONDARY_REBATE: number;
  TERTIARY_REBATE: number;
  COMPANY_TAX_RATE: number;
  MEDICAL_CREDIT_FIRST_TWO: number;
  MEDICAL_CREDIT_ADDITIONAL: number;
  PAYE_BRACKETS: PayeBracket[];
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
  PAYE_MONTHLY_THRESHOLD: 8250, // R99,000 under-65 threshold ÷ 12
  PRIMARY_REBATE: 17820,
  SECONDARY_REBATE: 9765,
  TERTIARY_REBATE: 3249,
  COMPANY_TAX_RATE: 0.27,
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
  TAX_YEAR: "2026/27",
};

// Map a tax_rates row to a TaxRateSet, or fall back to the hardcoded set when there
// is no row. Postgres NUMERIC arrives over the wire as a string, so coerce every
// figure; a malformed/empty bracket list falls back rather than breaking payroll.
export function resolveTaxRates(row: Tables<"tax_rates"> | null | undefined): TaxRateSet {
  if (!row) return TAX_RATES;
  const num = (v: unknown) => Number(v);
  const parsed: PayeBracket[] = Array.isArray(row.paye_brackets)
    ? (row.paye_brackets as unknown[]).map((b) => {
        const o = (b ?? {}) as Record<string, unknown>;
        return { from: Number(o.from), base: Number(o.base), rate: Number(o.rate) };
      })
    : [];
  // Guard the running app against a malformed row: calcPAYE scans brackets from
  // the top down and assumes ascending order, so a mis-ordered or blank band
  // (e.g. a trailing {from:0}) would zero PAYE for everyone. Require every band
  // finite, sort ascending, and fall back to the known-good hardcoded brackets
  // if anything is off — never silently compute R0 tax.
  const valid =
    parsed.length > 0 && parsed.every((b) => Number.isFinite(b.from) && Number.isFinite(b.base) && Number.isFinite(b.rate));
  const brackets = valid ? [...parsed].sort((a, b) => a.from - b.from) : TAX_RATES.PAYE_BRACKETS;
  return {
    VAT_RATE: num(row.vat_rate),
    MILEAGE_RATE: num(row.mileage_rate),
    TAX_JAR_RATE: num(row.tax_jar_rate),
    UIF_EMPLOYEE_RATE: num(row.uif_employee_rate),
    UIF_EMPLOYER_RATE: num(row.uif_employer_rate),
    UIF_CEILING: num(row.uif_ceiling),
    SDL_RATE: num(row.sdl_rate),
    SDL_ANNUAL_THRESHOLD: num(row.sdl_annual_threshold),
    PAYE_MONTHLY_THRESHOLD: num(row.paye_monthly_threshold),
    PRIMARY_REBATE: num(row.primary_rebate),
    SECONDARY_REBATE: num(row.secondary_rebate),
    TERTIARY_REBATE: num(row.tertiary_rebate),
    COMPANY_TAX_RATE: num(row.company_tax_rate),
    MEDICAL_CREDIT_FIRST_TWO: num(row.medical_credit_first_two),
    MEDICAL_CREDIT_ADDITIONAL: num(row.medical_credit_additional),
    PAYE_BRACKETS: brackets,
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

function calcPAYE(annualIncome: number, rates: TaxRateSet = TAX_RATES): number {
  if (annualIncome <= 0) return 0;
  const brackets = rates.PAYE_BRACKETS;
  for (let i = brackets.length - 1; i >= 0; i--) {
    const b = brackets[i];
    if (b && annualIncome > b.from) {
      return b.base + (annualIncome - b.from) * b.rate;
    }
  }
  return 0;
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
export { calcPAYE, calcMonthlyPAYE, calcUIF, calcMedicalCredit, calcRebate };

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
    calcMonthlyPAYE: (monthlyGross: number, payPeriod?: "Weekly" | "Fortnightly" | "Monthly") =>
      calcMonthlyPAYE(monthlyGross, payPeriod, rates),
    calcUIF: (grossWages: number) => calcUIF(grossWages, rates),
    calcMedicalCredit: (members: number) => calcMedicalCredit(members, rates),
    calcRebate: (ageBand?: AgeBand) => calcRebate(ageBand, rates),
    vatFromGross,
  };
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
