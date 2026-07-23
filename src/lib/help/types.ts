// Structured content model for help-centre articles. The generation workflow
// (help-center-workflow.js) emits this shape; content.ts holds the finalised
// articles and the pages under src/app/help render them. Structured data, not
// raw HTML — so consistent styling and no dangerouslySetInnerHTML.

export type HelpBlock = {
  type: "paragraph" | "steps" | "bullets" | "tip" | "warning";
  /** Present for paragraph / tip / warning. */
  text?: string;
  /** Present for steps (numbered) / bullets. */
  items?: string[];
};

export type HelpSection = {
  heading: string;
  blocks: HelpBlock[];
};

export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  sections: HelpSection[];
  /** Slugs of related articles. */
  related?: string[];
};

// Category display order + an icon and one-line blurb for the index. Article
// `category` values must match a `name` here; anything unmatched still renders
// under its own name at the end.
export const HELP_CATEGORIES: { name: string; icon: string; blurb: string }[] = [
  { name: "Getting started", icon: "🚀", blurb: "Set up your business and find your way around." },
  { name: "Price list & pricing", icon: "🏷️", blurb: "Items, materials and job costing." },
  { name: "Sales", icon: "📤", blurb: "Quotes, invoices, statements and getting paid." },
  { name: "Purchases", icon: "📥", blurb: "Purchase orders, supplier bills and remittances." },
  { name: "Money", icon: "🏦", blurb: "Bank statements, cash-up, accounts and ledgers." },
  { name: "Scheduling", icon: "📅", blurb: "Diary, time and mileage." },
  { name: "Payroll & HR", icon: "👷", blurb: "Staff, pay runs, leave and advances." },
  { name: "Team & users", icon: "👥", blurb: "Invite people and set what they can access." },
  { name: "Tax & SARS", icon: "🧾", blurb: "VAT201, provisional tax and compliance." },
  { name: "Reports", icon: "📊", blurb: "Profit, cash flow and who owes you." },
];
