// Hardcoded for v1 (matches the "manual flag, no live infra yet" decision).
// Shape mirrors the source prototype's real useTaxRates() hook so a future
// swap to a DB-backed/admin-editable rates table is a drop-in replacement,
// not a call-site rewrite. PAYE/UIF/SDL added for Payroll — figures are the
// prototype's 2025/26 SARS fallback constants.

const PAYE_BRACKETS = [
  { from: 0, base: 0, rate: 0.18 },
  { from: 237100, base: 42678, rate: 0.26 },
  { from: 370500, base: 77362, rate: 0.31 },
  { from: 512800, base: 121475, rate: 0.36 },
  { from: 673000, base: 179147, rate: 0.39 },
  { from: 857900, base: 251258, rate: 0.41 },
  { from: 1817000, base: 644489, rate: 0.45 },
];

// SARS grants an age-based rebate on top of the primary one. They stack: a
// 76-year-old gets all three. The published tax thresholds fall straight out of
// them — 17,235/0.18 = R95,750 under 65, (17,235+9,444)/0.18 = R148,217 at
// 65-74, (17,235+9,444+3,145)/0.18 = R165,689 at 75+ — which is what the tests
// assert, so a typo here can't pass quietly.
const PRIMARY_REBATE = 17235;
const SECONDARY_REBATE = 9444; // additional, from age 65
const TERTIARY_REBATE = 3145; // additional again, from age 75
const PAYE_MONTHLY_THRESHOLD = 7979;
const UIF_EMPLOYEE_RATE = 0.01;
const UIF_EMPLOYER_RATE = 0.01;
const UIF_CEILING = 17712;
const SDL_RATE = 0.01;
// Annual payroll above which SDL registration is required.
const SDL_ANNUAL_THRESHOLD = 500000;
const COMPANY_TAX_RATE = 0.27;
const MEDICAL_CREDIT_FIRST_TWO = 364;
const MEDICAL_CREDIT_ADDITIONAL = 246;

// Exported as plain values as well as via the hook: server code (the help
// assistant's system prompt) needs the same figures, and must not call a
// use*-prefixed function to get them.
export const TAX_RATES = {
  VAT_RATE: 0.15,
  MILEAGE_RATE: 4.84,
  TAX_JAR_RATE: 0.28,
  UIF_EMPLOYEE_RATE,
  UIF_EMPLOYER_RATE,
  UIF_CEILING,
  SDL_RATE,
  SDL_ANNUAL_THRESHOLD,
  PAYE_MONTHLY_THRESHOLD,
  PRIMARY_REBATE,
  SECONDARY_REBATE,
  TERTIARY_REBATE,
  COMPANY_TAX_RATE,
  MEDICAL_CREDIT_FIRST_TWO,
  MEDICAL_CREDIT_ADDITIONAL,
  TAX_YEAR: "2025/26",
};

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

function calcPAYE(annualIncome: number): number {
  if (annualIncome <= 0) return 0;
  for (let i = PAYE_BRACKETS.length - 1; i >= 0; i--) {
    if (annualIncome > PAYE_BRACKETS[i].from) {
      return PAYE_BRACKETS[i].base + (annualIncome - PAYE_BRACKETS[i].from) * PAYE_BRACKETS[i].rate;
    }
  }
  return 0;
}

// Monthly PAYE for a given gross, assuming the same amount every month all year.
function calcMonthlyPAYE(monthlyGross: number, payPeriod: "Weekly" | "Fortnightly" | "Monthly" = "Monthly"): number {
  if (monthlyGross <= PAYE_MONTHLY_THRESHOLD) return 0;
  const annualTax = Math.max(0, calcPAYE(monthlyGross * 12) - PRIMARY_REBATE);
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
function calcRebate(ageBand: AgeBand = "under65"): number {
  let total = PRIMARY_REBATE;
  if (ageBand === "65to74" || ageBand === "75plus") total += SECONDARY_REBATE;
  if (ageBand === "75plus") total += TERTIARY_REBATE;
  return total;
}

function calcUIF(grossWages: number): { employee: number; employer: number; total: number } {
  const base = Math.min(grossWages, UIF_CEILING);
  return {
    employee: base * UIF_EMPLOYEE_RATE,
    employer: base * UIF_EMPLOYER_RATE,
    total: base * (UIF_EMPLOYEE_RATE + UIF_EMPLOYER_RATE),
  };
}

// Annual medical tax credit: a flat amount for each of the first two members,
// a lower amount for every member after that.
function calcMedicalCredit(members: number): number {
  if (members <= 0) return 0;
  const monthly =
    members <= 2
      ? members * MEDICAL_CREDIT_FIRST_TWO
      : 2 * MEDICAL_CREDIT_FIRST_TWO + (members - 2) * MEDICAL_CREDIT_ADDITIONAL;
  return monthly * 12;
}

// The calculations are plain functions and are exported as such — the build
// spec asks for "a well-tested /lib/tax module", and a module you can only
// reach through a use*-prefixed wrapper isn't one: server code can't call it,
// and a test importing it trips rules-of-hooks.
//
// useTaxRates() stays as the component-facing convenience, bundling the rates
// and the helpers together. It is not a real hook (no state, no effects) and
// only carries the prefix to match the prototype's API, so that a later swap to
// DB-backed rates is a drop-in rather than a call-site rewrite.
export { calcPAYE, calcMonthlyPAYE, calcUIF, calcMedicalCredit, calcRebate };

export function useTaxRates() {
  return { ...TAX_RATES, calcPAYE, calcMonthlyPAYE, calcUIF, calcMedicalCredit, calcRebate, vatFromGross };
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
