// SA business compliance obligations — ported from worklog-v65.jsx's
// ComplianceDashboard. Status is derived from the real business profile plus
// tax_filings recency, rather than the prototype's registration-status-only
// checks. Reference URLs and penalty notes are the prototype's copy verbatim.

export type ComplianceStatus = "green" | "amber" | "red" | "blue" | "grey";

export type Obligation = {
  group: string;
  id: string;
  icon: string;
  title: string;
  freq: string;
  due: string;
  status: ComplianceStatus;
  where: "worklog" | "external" | "accountant";
  href?: string;
  note: string;
  cta: string;
  ctaUrl?: string;
};

export const STATUS_STYLE: Record<ComplianceStatus, { color: string; bg: string; border: string; dot: string }> = {
  green: { color: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD", dot: "#0EA5E9" },
  amber: { color: "#92400e", bg: "#fffbeb", border: "#fde68a", dot: "#d97706" },
  red: { color: "#9a3412", bg: "#fff7ed", border: "#fed7aa", dot: "#ea580c" },
  blue: { color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe", dot: "#2a78d6" },
  grey: { color: "#374151", bg: "#f8fafc", border: "#e2e8f0", dot: "#94a3b8" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function isRecent(dateStr: string | null | undefined, withinDays: number): boolean {
  if (!dateStr) return false;
  const days = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= withinDays;
}

export type ComplianceContext = {
  hasVat: boolean;
  hasPaye: boolean;
  hasEmployees: boolean;
  employeeCount: number;
  annualIncome: number;
  lastVat201Date: string | null;
  lastEmp201Date: string | null;
};

export function buildObligations(ctx: ComplianceContext): Obligation[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // 1-based
  const needsVat = ctx.annualIncome > 1_000_000;

  const nextMonthName = MONTHS[month % 12];
  const nextMonthYear = month === 12 ? year + 1 : year;
  const vatDue = `25 ${nextMonthName} ${nextMonthYear}`;
  const emp201Due = `7 ${nextMonthName} ${nextMonthYear}`;
  const provDue = month <= 8 ? `31 Aug ${year}` : `28 Feb ${year + 1}`;

  return [
    {
      group: "SARS",
      id: "vat201",
      icon: "🏦",
      title: "VAT201 Return",
      freq: "Monthly or bi-monthly",
      due: ctx.hasVat ? vatDue : "Not registered",
      status: ctx.hasVat ? (isRecent(ctx.lastVat201Date, 35) ? "green" : "amber") : needsVat ? "red" : "grey",
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
      due: ctx.hasEmployees ? emp201Due : "No employees",
      status: ctx.hasEmployees && ctx.hasPaye ? (isRecent(ctx.lastEmp201Date, 35) ? "green" : "amber") : ctx.hasEmployees ? "amber" : "grey",
      where: ctx.hasEmployees ? "worklog" : "external",
      href: "/emp201",
      note: ctx.hasEmployees
        ? "PAYE, UIF and SDL declared and paid by the 7th. Use the WORKLOG EMP201 tool to generate the summary, then pay via eFiling. Penalty: 10% of PAYE + R100/month late filing."
        : "Required as soon as you have any employee. Register as an employer with SARS when you hire your first person.",
      cta: ctx.hasEmployees ? "Open EMP201" : "Register on eFiling",
      ctaUrl: "https://www.sarsefiling.co.za",
    },
    {
      group: "SARS",
      id: "provtax",
      icon: "📅",
      title: "Provisional Tax (IRP6)",
      freq: "Twice yearly — Aug and Feb",
      due: provDue,
      status: "green",
      where: "worklog",
      href: "/provtax",
      note: "Period 1 (P1) due 31 August — based on first 6 months income. Period 2 (P2) due last day of February — full year. Penalty: 20% if estimate is more than 20% below actual tax. WORKLOG estimates your amount due — submit the actual return via eFiling or your accountant.",
      cta: "Open IRP6 Estimator",
    },
    {
      group: "SARS",
      id: "annualtax",
      icon: "📋",
      title: "Annual Income Tax (ITR12 / ITR14)",
      freq: "Once yearly",
      due: `Last day of Feb ${year + 1}`,
      status: "blue",
      where: "accountant",
      note: "Filed via eFiling or your tax practitioner. ITR12 for individuals and sole proprietors. ITR14 for companies. Requires proper treatment of deductions, depreciation (wear and tear), home office claims, and capital gains. Your WORKLOG P&L and expense records are the source data — export them for your accountant.",
      cta: "Open eFiling",
      ctaUrl: "https://www.sarsefiling.co.za",
    },
    {
      group: "Dept of Labour",
      id: "uif",
      icon: "🛡️",
      title: "UIF Monthly Declaration (UIF-2)",
      freq: "Monthly by 7th",
      due: ctx.hasEmployees ? emp201Due : "No employees",
      status: ctx.hasEmployees ? "amber" : "grey",
      where: "external",
      note: ctx.hasEmployees
        ? "Declare each employee and their UIF contributions monthly via uFiling (ufiling.labour.gov.za). The same deadline as EMP201 — 7th of the month. A UIF Compliance Certificate is required for any government tender. Non-compliance means your employees have no UIF cover when they need it — and you remain personally liable for those contributions."
        : "Required as soon as you employ any person, even part-time or casual. Register on uFiling and declare monthly.",
      cta: "Go to uFiling",
      ctaUrl: "https://www.ufiling.co.za",
    },
    {
      group: "Dept of Labour",
      id: "coida_roe",
      icon: "🏗️",
      title: "COIDA Return of Earnings (W.Cl.2)",
      freq: "Annually — 31 March",
      due: `31 Mar ${year + 1}`,
      status: ctx.hasEmployees ? "amber" : "grey",
      where: "external",
      note: ctx.hasEmployees
        ? "Declare your annual payroll to the Compensation Fund every March. Your WORKLOG payroll records have the figures you need. File on the CompEasy portal (workmanscomp.co.za). Without a valid Letter of Good Standing: you are personally liable for all workplace injury costs, and you cannot win any government or private-sector tender."
        : "Required for any employer. Register with the Compensation Fund before staff start work.",
      cta: "Go to CompEasy",
      ctaUrl: "https://www.workmanscomp.co.za",
    },
    {
      group: "Dept of Labour",
      id: "coida_logs",
      icon: "📜",
      title: "COIDA Letter of Good Standing",
      freq: "Renewed annually",
      due: "Renew after Return of Earnings filed",
      status: ctx.hasEmployees ? "amber" : "grey",
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
      due: "Annual — check BizPortal",
      status: "blue",
      where: "external",
      note: "For registered companies (Pty Ltd, NPC, CC) only. Filed and fee paid on BizPortal (bizportal.gov.za). Fee is turnover-based — R100–R3,000 depending on size. A deregistered company cannot sign contracts or open bank accounts. Sole traders and partnerships do not need this.",
      cta: "Go to BizPortal",
      ctaUrl: "https://www.bizportal.gov.za",
    },
    {
      group: "CIPC",
      id: "beneficial",
      icon: "👤",
      title: "Beneficial Ownership Declaration",
      freq: "Annually (with Annual Return)",
      due: "Annual — check BizPortal",
      status: "blue",
      where: "external",
      note: "Declared on BizPortal alongside the Annual Return. Lists all individuals who ultimately own or control 5% or more of the company. Required since April 2024. Has been blocking Annual Return filings when outstanding — resolve on BizPortal before your Annual Return.",
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
      status: "amber",
      where: "external",
      note: "Every business that handles personal data (client names, emails, phone numbers — which every WORKLOG user does) must register an Information Officer with the Information Regulator. By default this is the owner/CEO. Register on the Information Regulator portal (justice.gov.za/inforeg). Fines up to R10 million. One-off task: takes about 30 minutes.",
      cta: "Go to InfoReg",
      ctaUrl: "https://www.justice.gov.za/inforeg",
    },
  ];
}
