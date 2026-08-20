import { EXPENSE_PAYMENT_METHODS, narrowMethodsForAccount } from "@/lib/sarsCategories";

// What kind of account this is — and, because the two are the same question
// asked twice, what a payment against it may be called.
//
// The labels used to be their own vocabulary ("Credit card") while Log income
// and Log expense offered another ("Card"), so the account you tagged and the
// method you picked never quite read as the same thing. They are named off the
// payment methods now, and each type's accepted methods are DERIVED from the
// same narrowing the two forms apply — so the list on this screen cannot drift
// from the chips that actually appear when money is logged.
//
// The ids are what the database stores and stay as they were; only the words
// people read changed.
export const ACCOUNT_TYPES = ["bank", "savings", "credit", "cash", "other"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_META: Record<AccountType, { label: string; icon: string; hint: string }> = {
  bank: { label: "Bank", icon: "🏦", hint: "A cheque or current account — the everyday one money moves through." },
  savings: { label: "Savings", icon: "🐷", hint: "Money put away. Transfers in and out, not day-to-day trading." },
  credit: { label: "Card", icon: "💳", hint: "A credit or store card. Spending here is money you owe, not money you hold." },
  cash: { label: "Cash", icon: "💵", hint: "A till, a cash box, the notes in your pocket. What Cash-ups counts." },
  other: { label: "Other", icon: "📁", hint: "Anything that isn't one of the above — a wallet app, a loan account." },
};

export function normaliseAccountType(v: unknown): AccountType {
  const s = String(v ?? "").trim().toLowerCase();
  if ((ACCOUNT_TYPES as readonly string[]).includes(s)) return s as AccountType;
  // Accept what someone would reasonably type into a spreadsheet column.
  if (/cheque|current|transmission/.test(s)) return "bank";
  if (/save|savings|money market/.test(s)) return "savings";
  if (/card|credit|store/.test(s)) return "credit";
  if (/cash|till|petty|float/.test(s)) return "cash";
  return "bank";
}

export const accountTypeMeta = (v: string | null | undefined) => ACCOUNT_TYPE_META[normaliseAccountType(v)];

/**
 * The payment methods this kind of account can be used with — the exact chips
 * Log income and Log expense will offer once an entry is tagged to it. Both
 * directions carry the same list, so narrowing either one answers for both.
 */
export function methodsForAccountType(v: string | null | undefined): string[] {
  return narrowMethodsForAccount(EXPENSE_PAYMENT_METHODS, normaliseAccountType(v));
}
