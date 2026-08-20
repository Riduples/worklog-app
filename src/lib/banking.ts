// One list over money that moved, assembled from the three tables that already
// hold it: income, expenses and account_transfers.
//
// Deliberately NOT a new table. Banking is a merge of three screens into one, a
// question about where a person goes and what they are asked — not a question
// about how the rows are stored. The existing tables are already the right
// shape: income carries who paid and the invoice it settles, expenses carries
// who was paid and the bill it settles, transfers carry two accounts. Moving all
// of that into a fourth table would mean rewriting every reader of it — pnl,
// vat201, the sales and purchases reports, cash position, the dashboard — to
// prove nothing changed. The reporting is the part that must stay correct, so
// the reporting is the part this does not touch.
//
// What Banking adds is the front door: one place, one type switch, one list.
// Everything below is presentation over rows that already exist.

export type BankingKind = "in" | "out" | "transfer";
export type BankingSource = "income" | "expense" | "transfer";

/** How a row reaches the reports — the thing the tile has to make obvious. */
export type Allocation =
  /** Settles an invoice or a bill; that document carries the income or cost. */
  | "matched"
  /** Booked straight to a SARS heading. */
  | "categorised"
  /** Owner's money in or out — deliberately outside the business totals. */
  | "personal"
  /** Between your own accounts; neither income nor cost, so nothing to allocate. */
  | "transfer"
  /** Nothing yet. Lands under Uncategorised until someone says where it goes. */
  | "unallocated";

export type BankingTx = {
  /** Unique across sources — the row ids are only unique within their table. */
  key: string;
  source: BankingSource;
  id: string;
  kind: BankingKind;
  date: string;
  /** Always positive; `kind` carries the direction. */
  amount: number;
  party: string | null;
  description: string | null;
  method: string | null;
  accountId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  category: string | null;
  /** The document this settles, e.g. "INV-0042" — null when nothing is matched. */
  docLabel: string | null;
  allocation: Allocation;
  reconciled: boolean;
  isPersonal: boolean;
};

type IncomeRow = {
  id: string;
  transaction_date: string;
  amount: number | string;
  received_from?: string | null;
  what_for?: string | null;
  details?: string | null;
  payment_method?: string | null;
  account_id?: string | null;
  sars_category?: string | null;
  matched_invoice_id?: string | null;
  matched_ledger_entry_id?: string | null;
  reconciled_at?: string | null;
  is_personal?: boolean | null;
};

type ExpenseRow = {
  id: string;
  transaction_date: string;
  amount: number | string;
  paid_to?: string | null;
  what_for?: string | null;
  details?: string | null;
  payment_method?: string | null;
  account_id?: string | null;
  sars_category?: string | null;
  matched_supplier_invoice_id?: string | null;
  matched_ledger_entry_id?: string | null;
  reconciled_at?: string | null;
  is_personal?: boolean | null;
};

type TransferRow = {
  id: string;
  transfer_date: string;
  amount: number | string;
  from_account_id: string;
  to_account_id: string;
  note?: string | null;
  reconciled_at?: string | null;
};

export type BankingInputs = {
  income?: IncomeRow[] | null;
  expenses?: ExpenseRow[] | null;
  transfers?: TransferRow[] | null;
  /** id → doc number, for the chip that names what a row settles. */
  invoiceLabels?: Map<string, string> | null;
  supplierInvoiceLabels?: Map<string, string> | null;
};

/**
 * Why this row is (or isn't) accounted for.
 *
 * Order matters. A matched row is matched even if it also carries a category —
 * the document is the record, and that is what the reports read. Personal money
 * is next because it is a deliberate exclusion rather than an omission, and
 * reading it as "unallocated" would put a permanent chore on the list that
 * nobody can ever clear.
 */
function allocationOf(opts: {
  kind: BankingKind;
  matched: boolean;
  isPersonal: boolean;
  category: string | null;
}): Allocation {
  if (opts.kind === "transfer") return "transfer";
  if (opts.matched) return "matched";
  if (opts.isPersonal) return "personal";
  if (opts.category) return "categorised";
  return "unallocated";
}

/** Merge the three sources into one list, newest first. */
export function toBankingRows(inputs: BankingInputs): BankingTx[] {
  const rows: BankingTx[] = [];

  for (const r of inputs.income ?? []) {
    const matchedId = r.matched_invoice_id ?? null;
    const matched = !!(matchedId || r.matched_ledger_entry_id);
    const isPersonal = !!r.is_personal;
    rows.push({
      key: `income:${r.id}`,
      source: "income",
      id: r.id,
      kind: "in",
      date: r.transaction_date,
      amount: Math.abs(Number(r.amount) || 0),
      party: r.received_from ?? null,
      description: r.what_for ?? r.details ?? null,
      method: r.payment_method ?? null,
      accountId: r.account_id ?? null,
      fromAccountId: null,
      toAccountId: null,
      category: r.sars_category ?? null,
      docLabel: matchedId ? inputs.invoiceLabels?.get(matchedId) ?? "Invoice" : null,
      allocation: allocationOf({ kind: "in", matched, isPersonal, category: r.sars_category ?? null }),
      reconciled: !!r.reconciled_at,
      isPersonal,
    });
  }

  for (const r of inputs.expenses ?? []) {
    const matchedId = r.matched_supplier_invoice_id ?? null;
    const matched = !!(matchedId || r.matched_ledger_entry_id);
    const isPersonal = !!r.is_personal;
    rows.push({
      key: `expense:${r.id}`,
      source: "expense",
      id: r.id,
      kind: "out",
      date: r.transaction_date,
      amount: Math.abs(Number(r.amount) || 0),
      party: r.paid_to ?? null,
      description: r.what_for ?? r.details ?? null,
      method: r.payment_method ?? null,
      accountId: r.account_id ?? null,
      fromAccountId: null,
      toAccountId: null,
      category: r.sars_category ?? null,
      docLabel: matchedId ? inputs.supplierInvoiceLabels?.get(matchedId) ?? "Bill" : null,
      allocation: allocationOf({ kind: "out", matched, isPersonal, category: r.sars_category ?? null }),
      reconciled: !!r.reconciled_at,
      isPersonal,
    });
  }

  for (const r of inputs.transfers ?? []) {
    rows.push({
      key: `transfer:${r.id}`,
      source: "transfer",
      id: r.id,
      kind: "transfer",
      date: r.transfer_date,
      amount: Math.abs(Number(r.amount) || 0),
      party: null,
      description: r.note ?? null,
      method: null,
      accountId: null,
      fromAccountId: r.from_account_id,
      toAccountId: r.to_account_id,
      category: null,
      docLabel: null,
      allocation: "transfer",
      reconciled: !!r.reconciled_at,
      isPersonal: false,
    });
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
}

export type BankingFilter = {
  search?: string;
  kind?: BankingKind | "all";
  /** "unallocated" and "unreconciled" are states, not kinds — hence separate. */
  flag?: "unallocated" | "unreconciled" | null;
  accountId?: string | null;
};

/** Does this row touch the given account, on either side of a transfer? */
export function touchesAccount(tx: BankingTx, accountId: string): boolean {
  return tx.accountId === accountId || tx.fromAccountId === accountId || tx.toAccountId === accountId;
}

export function filterBanking(
  rows: BankingTx[],
  f: BankingFilter,
  accountName?: (id: string | null | undefined) => string | null
): BankingTx[] {
  const q = (f.search ?? "").trim().toLowerCase();
  return rows.filter((tx) => {
    if (f.kind && f.kind !== "all" && tx.kind !== f.kind) return false;
    if (f.flag === "unallocated" && tx.allocation !== "unallocated") return false;
    if (f.flag === "unreconciled" && tx.reconciled) return false;
    if (f.accountId && !touchesAccount(tx, f.accountId)) return false;
    if (!q) return true;
    // Searched by what a person can see on the tile — including the account
    // names, which are the only words on a transfer row.
    const hay = [
      tx.party,
      tx.description,
      tx.category,
      tx.docLabel,
      tx.method,
      accountName?.(tx.accountId),
      accountName?.(tx.fromAccountId),
      accountName?.(tx.toAccountId),
      String(tx.amount),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export type BankingSort = "date" | "amount" | "az";

export function sortBanking(rows: BankingTx[], sort: BankingSort): BankingTx[] {
  const copy = [...rows];
  if (sort === "amount") return copy.sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key));
  if (sort === "az")
    return copy.sort(
      (a, b) => (a.party ?? a.description ?? "").localeCompare(b.party ?? b.description ?? "") || a.key.localeCompare(b.key)
    );
  return copy.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
}

export type BankingTotals = { in: number; out: number; net: number; transfers: number };

/**
 * What the rows showing add up to.
 *
 * Transfers are counted apart and left out of the net on purpose: money moved
 * between your own accounts is neither in nor out, and folding it into a single
 * figure would make a R5,000 shuffle between two of your own accounts read as
 * R5,000 of trade.
 */
export function bankingTotals(rows: BankingTx[]): BankingTotals {
  let inSum = 0;
  let outSum = 0;
  let tfSum = 0;
  for (const tx of rows) {
    if (tx.kind === "in") inSum += tx.amount;
    else if (tx.kind === "out") outSum += tx.amount;
    else tfSum += tx.amount;
  }
  return { in: inSum, out: outSum, net: inSum - outSum, transfers: tfSum };
}

export const ALLOCATION_META: Record<Allocation, { label: string; tone: "doc" | "cat" | "todo" | "quiet" }> = {
  matched: { label: "Matched", tone: "doc" },
  categorised: { label: "Categorised", tone: "cat" },
  personal: { label: "Personal", tone: "quiet" },
  transfer: { label: "Transfer", tone: "quiet" },
  unallocated: { label: "Needs a home", tone: "todo" },
};
