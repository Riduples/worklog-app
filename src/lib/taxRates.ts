// Hardcoded for v1 (matches the "manual flag, no live infra yet" decision).
// Shape mirrors the source prototype's real useTaxRates() hook so a future
// swap to a DB-backed/admin-editable rates table is a drop-in replacement,
// not a call-site rewrite.
const RATES = {
  VAT_RATE: 0.15,
  MILEAGE_RATE: 4.84,
  TAX_JAR_RATE: 0.28,
};

export function useTaxRates() {
  return RATES;
}
