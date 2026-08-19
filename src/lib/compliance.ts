// SA business compliance obligations — ported from worklog-v65.jsx's
// ComplianceDashboard. Status is derived from the real business profile plus
// tax_filings recency, rather than the prototype's registration-status-only
// checks. Reference URLs and penalty notes are the prototype's copy verbatim.

import { annualReturnForm, registeredWithCipc, type TaxEntityType } from "@/lib/entityTypes";
import { toLocalIsoDate } from "@/lib/format";

// Named for what they mean, not what they look like. These were once "green" /
// "amber" / "red" / "blue" / "grey", which stopped being true when the app went
// navy: "green" rendered sky-blue and sat next to a separate "blue". The names
// below are the labels the dashboard already puts on screen.
export type ComplianceStatus = "ready" | "action" | "register" | "elsewhere" | "na";

export type Obligation = {
  group: string;
  id: string;
  icon: string;
  title: string;
  freq: string;
  due: string;
  // The concrete next-due date (local ISO yyyy-mm-dd) for time-bound obligations
  // — VAT201, EMP201, provisional tax, the annual return, UIF, COIDA — so the home
  // screen can rank and count down the soonest ones. null for the once-off /
  // check-the-portal items (CIPC, POPIA) that have no fixed recurring date.
  dueDate: string | null;
  status: ComplianceStatus;
  where: "worklog" | "external" | "accountant";
  href?: string;
  note: string;
  cta: string;
  ctaUrl?: string;
};

export const STATUS_STYLE: Record<ComplianceStatus, { color: string; bg: string; border: string; dot: string }> = {
  ready: { color: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD", dot: "#0EA5E9" },
  action: { color: "#92400e", bg: "#fffbeb", border: "#fde68a", dot: "#d97706" },
  register: { color: "#9a3412", bg: "#fff7ed", border: "#fed7aa", dot: "#ea580c" },
  elsewhere: { color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe", dot: "#2a78d6" },
  na: { color: "#374151", bg: "#f8fafc", border: "#e2e8f0", dot: "#94a3b8" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isRecent(dateStr: string | null | undefined, withinDays: number): boolean {
  if (!dateStr) return false;
  const days = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= withinDays;
}

// ── Next-occurrence helpers ──────────────────────────────────────────────────
// All local-date arithmetic (the app is SAST, no DST) so a deadline lands on the
// calendar day the owner expects, never a UTC-shifted one.
function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function fmtDMY(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
/** The next calendar occurrence (today or later) of a given day-of-month. */
function nextDayOfMonth(day: number, from: Date): Date {
  const floor = atMidnight(from).getTime();
  let d = new Date(from.getFullYear(), from.getMonth(), day);
  if (d.getTime() < floor) d = new Date(from.getFullYear(), from.getMonth() + 1, day);
  return d;
}
/** Last day of February for a year (day 0 of March). */
function lastDayOfFeb(year: number): Date {
  return new Date(year, 2, 0);
}
/** Next end-of-February (the annual-return / provisional P2 anchor). */
function nextEndOfFeb(from: Date): Date {
  const floor = atMidnight(from).getTime();
  const d = lastDayOfFeb(from.getFullYear());
  return d.getTime() < floor ? lastDayOfFeb(from.getFullYear() + 1) : d;
}
/** Next provisional-tax date: the soonest of 31 Aug / end-of-Feb. */
function nextProvisional(from: Date): Date {
  const floor = atMidnight(from).getTime();
  const y = from.getFullYear();
  return [new Date(y, 7, 31), lastDayOfFeb(y), lastDayOfFeb(y + 1), new Date(y + 1, 7, 31)]
    .filter((d) => d.getTime() >= floor)
    .sort((a, b) => a.getTime() - b.getTime())[0]!;
}
/** Next 31 March (COIDA Return of Earnings). */
function nextMar31(from: Date): Date {
  const floor = atMidnight(from).getTime();
  const d = new Date(from.getFullYear(), 2, 31);
  return d.getTime() < floor ? new Date(from.getFullYear() + 1, 2, 31) : d;
}

export type ComplianceContext = {
  hasVat: boolean;
  hasPaye: boolean;
  hasEmployees: boolean;
  employeeCount: number;
  annualIncome: number;
  lastVat201Date: string | null;
  lastEmp201Date: string | null;
  // The business's SARS legal form, or null if the owner hasn't set one. When
  // null the dashboard keeps its old form-agnostic behaviour rather than guessing.
  entityType: TaxEntityType | null;
  // Registered for Turnover Tax — the single simplified tax that replaces income
  // tax, provisional tax, CGT and dividends tax for a qualifying micro business.
  onTurnoverTax: boolean;
};

export function buildObligations(ctx: ComplianceContext, now: Date = new Date()): Obligation[] {
  const today = now;
  const needsVat = ctx.annualIncome > 1_000_000;

  const entity = ctx.entityType;
  // The annual return this legal form files (ITR12 / ITR14 / IT12TR).
  const annualForm = annualReturnForm(entity);
  // Whether CIPC returns apply. Tri-state on purpose: true (company/CC/co-op),
  // false (sole prop / partnership / trust — genuinely exempt), or null when the
  // form is unset, in which case we leave the CIPC items showing as before rather
  // than hide a real obligation on a guess.
  const cipcApplies = entity == null ? null : registeredWithCipc(entity);

  // Concrete next-due dates for the time-bound obligations (null when the
  // obligation doesn't apply — not VAT-registered / no employees).
  const vatDate = ctx.hasVat ? nextDayOfMonth(25, today) : null;
  const empDate = ctx.hasEmployees ? nextDayOfMonth(7, today) : null;
  const provDate = nextProvisional(today);
  const annualDate = nextEndOfFeb(today);
  const coidaDate = ctx.hasEmployees ? nextMar31(today) : null;
  const iso = (d: Date | null) => (d ? toLocalIsoDate(d) : null);

  return [
    {
      group: "SARS",
      id: "vat201",
      icon: "🏦",
      title: "VAT201 Return",
      freq: "Monthly or bi-monthly",
      due: vatDate ? fmtDMY(vatDate) : "Not registered",
      dueDate: iso(vatDate),
      status: ctx.hasVat ? (isRecent(ctx.lastVat201Date, 35) ? "ready" : "action") : needsVat ? "register" : "na",
      where: ctx.hasVat ? "worklog" : "external",
      href: "/vat201",
      note: ctx.hasVat
        ? "Submit by the 25th of the month following your VAT period. Penalty: 10% of tax + interest if late."
        : needsVat
          ? "Your income exceeds R1M — you are required to register for VAT with SARS. Register on eFiling."
          : "Optional below R1M turnover. Register when you're ready — input VAT claims can be worthwhile.",
      cta: ctx.hasVat ? "Open VAT201" : "Register on eFiling",
      ctaUrl: "https://www.sarsefiling.co.za",
    },
    {
      group: "SARS",
      id: "emp201",
      icon: "👷",
      title: "EMP201 Payroll Return",
      freq: "Monthly by 7th",
      due: empDate ? fmtDMY(empDate) : "No employees",
      dueDate: iso(empDate),
      status: ctx.hasEmployees && ctx.hasPaye ? (isRecent(ctx.lastEmp201Date, 35) ? "ready" : "action") : ctx.hasEmployees ? "action" : "na",
      where: ctx.hasEmployees ? "worklog" : "external",
      href: "/payroll-compliance?tab=emp201",
      note: ctx.hasEmployees
        ? "PAYE, UIF and SDL declared and paid by the 7th. Use the Payroll Compliance hub to generate the EMP201 summary, then pay via eFiling. Penalty: 10% of PAYE + R100/month late filing."
        : "Required as soon as you have any employee. Register as an employer with SARS when you hire your first person.",
      cta: ctx.hasEmployees ? "Open EMP201" : "Register on eFiling",
      ctaUrl: "https://www.sarsefiling.co.za",
    },
    {
      group: "SARS",
      id: "provtax",
      icon: "📅",
      // On Turnover Tax there is no provisional tax — the two interim TT02
      // payments take its place, on the same Aug/Feb rhythm.
      title: ctx.onTurnoverTax ? "Turnover Tax — interim payments (TT02)" : "Provisional Tax (IRP6)",
      freq: "Twice yearly — Aug and Feb",
      due: fmtDMY(provDate),
      dueDate: iso(provDate),
      status: "ready",
      where: "worklog",
      href: "/provtax",
      note: ctx.onTurnoverTax
        ? "On Turnover Tax you make two interim payments a year in place of provisional tax — the first by end of August, the second by the last day of February — each on the TT02 form. Worklog estimates the amount from your turnover; submit and pay via eFiling."
        : "Period 1 (P1) due 31 August — based on first 6 months income. Period 2 (P2) due last day of February — full year. Penalty: 20% if estimate is more than 20% below actual tax. Worklog estimates your amount due — submit the actual return via eFiling or your accountant.",
      cta: ctx.onTurnoverTax ? "Open Turnover Tax estimator" : "Open IRP6 Estimator",
    },
    {
      group: "SARS",
      id: "annualtax",
      icon: "📋",
      // Turnover Tax collapses income tax, CGT and dividends tax into one TT03
      // return; otherwise the form follows the legal entity type.
      // annualForm is null when the owner hasn't set a legal form yet — keep the
      // form-agnostic "ITR12 / ITR14" wording rather than guessing a personal ITR12.
      title: ctx.onTurnoverTax ? "Turnover Tax return (TT03)" : `Annual Income Tax (${annualForm ?? "ITR12 / ITR14"})`,
      freq: "Once yearly",
      due: `Last day of Feb ${annualDate.getFullYear()}`,
      dueDate: iso(annualDate),
      status: "elsewhere",
      where: "accountant",
      note: ctx.onTurnoverTax
        ? "On Turnover Tax you file one TT03 return a year in place of normal income tax — with no separate provisional, capital gains or dividends tax. Filed via eFiling or your tax practitioner; your Worklog turnover records are the source data."
        : `Filed via eFiling or your tax practitioner. ${
            annualForm === "ITR14"
              ? "As a company / CC / co-op you file an ITR14"
              : annualForm === "IT12TR"
                ? "As a trust you file an IT12TR"
                : annualForm === "ITR12"
                  ? "As a sole proprietor or partner you declare the business in your own personal ITR12"
                  : "The return depends on your legal form — a sole proprietor or partner declares it in their own personal ITR12, while a company, CC or co-op files an ITR14. Set your business type in Business details for guidance specific to you"
          }. Requires proper treatment of deductions, depreciation (wear and tear), home office claims, and capital gains. Your Worklog P&L and expense records are the source data — export them for your accountant.`,
      cta: "Open eFiling",
      ctaUrl: "https://www.sarsefiling.co.za",
    },
    {
      group: "Dept of Labour",
      id: "uif",
      icon: "🛡️",
      title: "UIF Monthly Declaration (UIF-2)",
      freq: "Monthly by 7th",
      due: empDate ? fmtDMY(empDate) : "No employees",
      dueDate: iso(empDate),
      status: ctx.hasEmployees ? "action" : "na",
      where: ctx.hasEmployees ? "worklog" : "external",
      href: "/payroll-compliance?tab=uif",
      note: ctx.hasEmployees
        ? "Work out the monthly UIF in the Payroll Compliance hub, then declare each employee on uFiling (ufiling.labour.gov.za) by the 7th — the same deadline as EMP201. A UIF Compliance Certificate is required for any government tender. Non-compliance means your employees have no UIF cover when they need it — and you remain personally liable for those contributions."
        : "Required as soon as you employ any person, even part-time or casual. Register on uFiling and declare monthly.",
      cta: ctx.hasEmployees ? "Open UIF declaration" : "Go to uFiling",
      ctaUrl: "https://www.ufiling.co.za",
    },
    {
      group: "Dept of Labour",
      id: "coida_roe",
      icon: "🏗️",
      title: "COIDA Return of Earnings (W.Cl.2)",
      freq: "Annually — 31 March",
      due: coidaDate ? fmtDMY(coidaDate) : "No employees",
      dueDate: iso(coidaDate),
      status: ctx.hasEmployees ? "action" : "na",
      where: ctx.hasEmployees ? "worklog" : "external",
      href: "/payroll-compliance?tab=coida",
      note: ctx.hasEmployees
        ? "Declare your annual payroll to the Compensation Fund every March. The Payroll Compliance hub adds up your earnings (capped at the OID maximum per employee) ready to report. File on the CompEasy portal (workmanscomp.co.za). Without a valid Letter of Good Standing: you are personally liable for all workplace injury costs, and you cannot win any government or private-sector tender."
        : "Required for any employer. Register with the Compensation Fund before staff start work.",
      cta: ctx.hasEmployees ? "Open Return of Earnings" : "Go to CompEasy",
      ctaUrl: "https://www.workmanscomp.co.za",
    },
    {
      group: "Dept of Labour",
      id: "coida_logs",
      icon: "📜",
      title: "COIDA Letter of Good Standing",
      freq: "Renewed annually",
      due: "Renew after Return of Earnings filed",
      dueDate: null,
      status: ctx.hasEmployees ? "action" : "na",
      where: "external",
      note: "Issued by the Compensation Fund after your Return of Earnings is filed and assessment paid. Required for government tenders, construction sites, and most principal contractor agreements. Download from CompEasy once issued. Keep a copy — inspectors check this on site visits.",
      cta: "Go to CompEasy",
      ctaUrl: "https://www.workmanscomp.co.za",
    },
    {
      group: "CIPC",
      id: "cipc_ar",
      icon: "🏢",
      title: "CIPC Annual Return",
      freq: "Annually — anniversary of registration",
      due: cipcApplies === false ? "Not applicable" : "Annual — check BizPortal",
      dueDate: null,
      // Only companies / CCs / co-ops register with CIPC. A known sole proprietor,
      // partnership or trust is genuinely exempt (na); an unset form keeps the
      // original always-shown behaviour.
      status: cipcApplies === false ? "na" : "elsewhere",
      where: "external",
      note:
        cipcApplies === false
          ? "Only registered companies, CCs and co-operatives file a CIPC Annual Return. As a sole proprietor, partnership or trust you aren't registered with CIPC, so this doesn't apply to you."
          : "For registered companies (Pty Ltd, NPC, CC) only. Filed and fee paid on BizPortal (bizportal.gov.za). Fee is turnover-based — R100–R3,000 depending on size. A deregistered company cannot sign contracts or open bank accounts. Sole traders and partnerships do not need this.",
      cta: "Go to BizPortal",
      ctaUrl: "https://www.bizportal.gov.za",
    },
    {
      group: "CIPC",
      id: "beneficial",
      icon: "👤",
      title: "Beneficial Ownership Declaration",
      freq: "Annually (with Annual Return)",
      due: cipcApplies === false ? "Not applicable" : "Annual — check BizPortal",
      dueDate: null,
      status: cipcApplies === false ? "na" : "elsewhere",
      where: "external",
      note:
        cipcApplies === false
          ? "Filed by companies and CCs alongside their CIPC Annual Return. It doesn't apply to sole proprietors, partnerships or trusts, which aren't registered with CIPC."
          : "Declared on BizPortal alongside the Annual Return. Lists all individuals who ultimately own or control 5% or more of the company. Required since April 2024. Has been blocking Annual Return filings when outstanding — resolve on BizPortal before your Annual Return.",
      cta: "Go to BizPortal",
      ctaUrl: "https://www.bizportal.gov.za",
    },
    {
      group: "POPIA",
      id: "popia_io",
      icon: "🔒",
      title: "Information Officer Registration",
      freq: "Once — then maintain",
      due: "Register once — check status",
      dueDate: null,
      status: "action",
      where: "external",
      note: "Every business that handles personal data (client names, emails, phone numbers — which every Worklog user does) must register an Information Officer with the Information Regulator. By default this is the owner/CEO. Register on the Information Regulator portal (justice.gov.za/inforeg). Fines up to R10 million. One-off task: takes about 30 minutes.",
      cta: "Go to InfoReg",
      ctaUrl: "https://www.justice.gov.za/inforeg",
    },
  ];
}

export type UpcomingDeadline = { obligation: Obligation; daysLeft: number };

// The time-bound obligations that fall due within `withinDays` from now, soonest
// first — the source for the home screen's deadline nudges. Skips the ones that
// don't apply (status "na") and the undated once-off items (dueDate null).
export function upcomingDeadlines(ctx: ComplianceContext, withinDays: number, now: Date = new Date()): UpcomingDeadline[] {
  const floor = atMidnight(now).getTime();
  return buildObligations(ctx, now)
    .filter((o) => o.dueDate != null && o.status !== "na")
    .map((o) => ({ obligation: o, daysLeft: Math.round((new Date(`${o.dueDate}T00:00:00`).getTime() - floor) / 86_400_000) }))
    .filter((x) => x.daysLeft >= 0 && x.daysLeft <= withinDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
