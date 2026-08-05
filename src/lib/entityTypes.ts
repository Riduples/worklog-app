// SARS legal-entity classification — the LEGAL FORM the business trades as.
//
// This is one of THREE independent axes SARS classifies a business on, and the
// app must not conflate them:
//
//   1. Legal entity type       — THIS file (sole proprietor, company, trust, …).
//                                Decides how income tax is worked out, which
//                                annual return is filed, and whether CIPC
//                                returns are owed.
//   2. Trade category          — businessTypes.ts (salon, spaza, …). Used only
//                                to decide which tools show on the home screen;
//                                nothing to do with tax.
//   3. Preferential tax regime — SBC / Turnover Tax, held as the is_sbc /
//                                on_turnover_tax flags on the profile, NOT as
//                                entity types. A company that qualifies as a
//                                Small Business Corporation is still a company;
//                                the regime rides on top of the entity type.

export type TaxEntityType =
  | "sole_proprietor"
  | "partnership"
  | "company"
  | "close_corporation"
  | "co_operative"
  | "trust";

export const TAX_ENTITY_TYPES: {
  id: TaxEntityType;
  label: string;
  short: string;
  desc: string;
}[] = [
  {
    id: "sole_proprietor",
    label: "Sole proprietor / Individual",
    short: "Sole proprietor",
    desc: "You and the business are one and the same. Profit is taxed in your own name on the individual tables.",
  },
  {
    id: "partnership",
    label: "Partnership",
    short: "Partnership",
    desc: "Two or more owners. The partnership isn't taxed itself — each partner is taxed individually on their share of the profit.",
  },
  {
    id: "company",
    label: "Company (Pty) Ltd",
    short: "Company",
    desc: "A company registered with CIPC. Pays company income tax and files an ITR14.",
  },
  {
    id: "close_corporation",
    label: "Close corporation (CC)",
    short: "Close corporation",
    desc: "A legacy CC. No new ones can be formed, but existing CCs still trade. Taxed like a company.",
  },
  {
    id: "co_operative",
    label: "Co-operative",
    short: "Co-operative",
    desc: "A registered co-operative. Taxed like a company, and can also qualify as a Small Business Corporation.",
  },
  {
    id: "trust",
    label: "Trust",
    short: "Trust",
    desc: "A trust. Taxed under its own rules at the flat trust rate, with no rebates.",
  },
];

/** Display metadata for an entity type, or null if unknown/unset. */
export function entityTypeMeta(entity: TaxEntityType | null | undefined) {
  return TAX_ENTITY_TYPES.find((e) => e.id === entity) ?? null;
}

// Forms that are separate legal persons taxed as companies — Corporate Income
// Tax at the flat rate, or the SBC sliding scale if they qualify. A sole
// proprietor and a partnership are taxed in the owners' hands instead; a trust
// has its own flat regime.
export function isCompanyLike(entity: TaxEntityType | null | undefined): boolean {
  return entity === "company" || entity === "close_corporation" || entity === "co_operative";
}

// Forms taxed in a natural person's hands on the individual tables — the owner of
// a sole proprietorship, or each partner on their share of the partnership.
export function isIndividuallyTaxed(entity: TaxEntityType | null | undefined): boolean {
  return entity === "sole_proprietor" || entity === "partnership";
}

// Only a company, CC or co-operative can elect the Small Business Corporation
// sliding scale (s12E). A sole proprietor, partnership or trust never qualifies,
// so the is_sbc flag is meaningless — and must be ignored — for those forms.
export function canQualifySbc(entity: TaxEntityType | null | undefined): boolean {
  return isCompanyLike(entity);
}

// Registered with CIPC, and so owing the CIPC Annual Return + Beneficial
// Ownership declaration. Sole traders and partnerships are not CIPC-registered; a
// trust is registered with the Master of the High Court, not CIPC.
export function registeredWithCipc(entity: TaxEntityType | null | undefined): boolean {
  return isCompanyLike(entity);
}

/** The annual income-tax return SARS expects for this legal form. */
export function annualReturnForm(entity: TaxEntityType | null | undefined): string {
  if (isCompanyLike(entity)) return "ITR14";
  if (entity === "trust") return "IT12TR";
  // Sole proprietor / partnership are declared in the owner's own personal
  // return; default to ITR12 when the form isn't set yet.
  return "ITR12";
}
