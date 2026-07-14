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

const PRIMARY_REBATE = 17235;
const PAYE_MONTHLY_THRESHOLD = 7979;
const UIF_EMPLOYEE_RATE = 0.01;
const UIF_EMPLOYER_RATE = 0.01;
const UIF_CEILING = 17712;
const SDL_RATE = 0.01;

const RATES = {
  VAT_RATE: 0.15,
  MILEAGE_RATE: 4.84,
  TAX_JAR_RATE: 0.28,
  UIF_EMPLOYEE_RATE,
  UIF_EMPLOYER_RATE,
  UIF_CEILING,
  SDL_RATE,
  PAYE_MONTHLY_THRESHOLD,
};

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

function calcUIF(grossWages: number): { employee: number; employer: number; total: number } {
  const base = Math.min(grossWages, UIF_CEILING);
  return {
    employee: base * UIF_EMPLOYEE_RATE,
    employer: base * UIF_EMPLOYER_RATE,
    total: base * (UIF_EMPLOYEE_RATE + UIF_EMPLOYER_RATE),
  };
}

export function useTaxRates() {
  return { ...RATES, calcPAYE, calcMonthlyPAYE, calcUIF };
}
