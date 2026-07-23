// ⚠️ LEGAL PLACEHOLDERS — FILL THESE IN before launch, then have a South African
// attorney review both /terms and /privacy. Every {{TOKEN}} used in the Terms of
// Service and Privacy Policy content is filled from this one object, so updating
// a value here updates it everywhere across both documents. Until these are set,
// the live pages will visibly show the bracketed placeholders — by design, so an
// unfinished document can't quietly go live looking finished.

export const COMPANY = {
  // The registered private company that operates Worklog.
  name: "[REGISTERED COMPANY NAME] (Pty) Ltd",
  regNo: "[COMPANY REGISTRATION NUMBER]",
  registeredAddress: "[REGISTERED BUSINESS ADDRESS]",
  // POPIA Information Officer — the person accountable for data protection.
  // Defaults to the CEO / public officer if not separately registered with the
  // Information Regulator.
  infoOfficer: "[INFORMATION OFFICER NAME]",
  supportEmail: "[SUPPORT / LEGAL EMAIL]",
  // ECTA s43 requires a phone number and web address in the supplier disclosure.
  supportPhone: "[SUPPORT PHONE NUMBER]",
  websiteUrl: "https://worklog.co.za",
  // The province whose High Court has jurisdiction (governing-law clause).
  governingProvince: "[PROVINCE, e.g. Gauteng]",
  // Shown as the effective / last-updated date on both documents.
  effectiveDate: "23 July 2026",
} as const;

// Bumped whenever the Terms or Privacy Policy materially change. Stamped into
// each new user's account metadata at signup so there is a record of which
// version they accepted (ECTA demonstrable assent). Keep it in YYYY-MM-DD form.
export const LEGAL_VERSION = "2026-07-23";

// Token -> value map. The keys are the {{TOKEN}} names used verbatim in the
// document content (see termsContent.ts / privacyContent.ts).
const LEGAL_TOKENS: Record<string, string> = {
  COMPANY_NAME: COMPANY.name,
  REG_NO: COMPANY.regNo,
  REGISTERED_ADDRESS: COMPANY.registeredAddress,
  INFO_OFFICER: COMPANY.infoOfficer,
  SUPPORT_EMAIL: COMPANY.supportEmail,
  SUPPORT_PHONE: COMPANY.supportPhone,
  WEBSITE_URL: COMPANY.websiteUrl,
  GOVERNING_PROVINCE: COMPANY.governingProvince,
  EFFECTIVE_DATE: COMPANY.effectiveDate,
};

// Replaces every {{TOKEN}} in a string with its configured value. Unknown tokens
// are left untouched (and thus visible) rather than blanked, so a typo surfaces
// instead of silently deleting text.
export function fillTokens(text: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in LEGAL_TOKENS ? LEGAL_TOKENS[key] : match
  );
}
