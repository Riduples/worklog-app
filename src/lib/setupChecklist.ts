// The dashboard "finish setting up" checklist — which activation steps a business
// has done, derived from real data (not a stored flag), so a step ticks itself
// off the moment the owner does it. Pure + structural so it can be unit-tested;
// the dashboard maps each `target` to a link or a modal, and the card hides once
// every step is done (or the owner dismisses it).

export type SetupTarget = "business" | "accounts" | "quicklog" | "invoices";

export type SetupStepDef = {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  target: SetupTarget;
};

export type SetupInput = {
  business: {
    address?: string | null;
    logo_url?: string | null;
    bank_name?: string | null;
    vat_number?: string | null;
    tax_entity_type?: string | null;
  } | null;
  accountCount: number;
  hasMoneyLogged: boolean;
  invoiceCount: number;
};

export function computeSetupSteps(input: SetupInput): SetupStepDef[] {
  const b = input.business;
  return [
    {
      key: "details",
      label: "Add your business details",
      hint: "Logo, address & banking so your documents look the part",
      // Name is set at sign-up; this step is about the detail that makes a quote
      // or invoice look professional — so it's done once any of those is filled in.
      done: !!(b && (b.address || b.logo_url || b.bank_name)),
      target: "business",
    },
    {
      key: "account",
      label: "Add a bank account",
      hint: "Track balances and reconcile your statements",
      done: input.accountCount > 0,
      target: "accounts",
    },
    {
      key: "money",
      label: "Log your first money in or out",
      hint: "Use Quick Log — just type, talk or snap a photo",
      done: input.hasMoneyLogged,
      target: "quicklog",
    },
    {
      key: "invoice",
      label: "Create your first quote or invoice",
      hint: "Send a professional document to a customer",
      done: input.invoiceCount > 0,
      target: "invoices",
    },
    {
      key: "tax",
      label: "Set your tax details",
      hint: "Your VAT number and business type, for accurate tax",
      done: !!(b && (b.vat_number || b.tax_entity_type)),
      target: "business",
    },
  ];
}
