// SARS VAT supply classification — how a sale is treated for VAT.
//
// A single VAT_RATE isn't enough: the VAT201 return declares the VALUE of
// standard-rated, zero-rated and exempt supplies on separate lines (fields 1, 2
// and 3), and they're taxed differently:
//
//   standard   — the standard rate (15%). Most goods and services.
//   zero_rated — taxable but at 0%: basic foodstuffs (brown bread, maize meal,
//                milk, rice, fresh produce, eggs …), exports, fuel, farming
//                inputs. No VAT is charged, but the turnover is still declared.
//   exempt     — outside VAT entirely: residential rent, most financial
//                services, public road/rail transport, some educational
//                services. No VAT charged and no input VAT claimable.
//
// This matters for Worklog's users specifically: a spaza shop's core stock is
// largely zero-rated, so treating every sale as standard-rated would overstate
// its output VAT and mis-declare its turnover.

export type VatSupplyType = "standard" | "zero_rated" | "exempt";

export const VAT_SUPPLY_TYPES: { id: VatSupplyType; label: string; short: string; desc: string }[] = [
  {
    id: "standard",
    label: "Standard-rated (15%)",
    short: "Standard",
    desc: "Most goods and services — VAT is charged at the standard rate.",
  },
  {
    id: "zero_rated",
    label: "Zero-rated (0%)",
    short: "Zero-rated",
    desc: "Taxable at 0% — e.g. brown bread, maize meal, milk, fresh produce, exports, fuel. No VAT charged, but the turnover is still declared.",
  },
  {
    id: "exempt",
    label: "Exempt",
    short: "Exempt",
    desc: "Outside VAT — e.g. residential rent, some financial services, public transport. No VAT charged and no input VAT claimable.",
  },
];

/** Display metadata for a supply type, defaulting to standard when unset. */
export function vatSupplyTypeMeta(t: VatSupplyType | null | undefined) {
  return VAT_SUPPLY_TYPES.find((v) => v.id === (t ?? "standard")) ?? VAT_SUPPLY_TYPES[0]!;
}

// Whether this supply actually carries output VAT. Only standard-rated does —
// zero-rated is taxed at 0% and exempt is outside VAT — so the VAT amount on a
// non-standard sale is always zero, however the rest of the form is filled in.
export function carriesVat(t: VatSupplyType | null | undefined): boolean {
  return (t ?? "standard") === "standard";
}
