import { describe, expect, it } from "vitest";
import {
  bankingTotals,
  filterBanking,
  sortBanking,
  toBankingRows,
  touchesAccount,
  type BankingTx,
} from "./banking";

const inc = (over: Record<string, unknown> = {}) => ({
  id: "i1",
  transaction_date: "2026-08-20",
  amount: 2300,
  received_from: "Thabo Nkosi",
  account_id: "acc1",
  ...over,
});

const exp = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  transaction_date: "2026-08-19",
  amount: 1150,
  paid_to: "Builders Warehouse",
  account_id: "acc1",
  ...over,
});

const tf = (over: Record<string, unknown> = {}) => ({
  id: "t1",
  transfer_date: "2026-08-18",
  amount: 5000,
  from_account_id: "acc1",
  to_account_id: "acc2",
  ...over,
});

describe("toBankingRows", () => {
  it("merges all three sources into one list", () => {
    const rows = toBankingRows({ income: [inc()], expenses: [exp()], transfers: [tf()] });
    expect(rows.map((r) => r.kind)).toEqual(["in", "out", "transfer"]);
  });

  it("keys rows by source so two tables sharing an id cannot collide", () => {
    // Nothing stops income and expenses both holding a row with id "1"; a list
    // keyed on the bare id would drop one of them.
    const rows = toBankingRows({ income: [inc({ id: "1" })], expenses: [exp({ id: "1" })] });
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });

  it("sorts newest first", () => {
    const rows = toBankingRows({
      income: [inc({ id: "old", transaction_date: "2026-01-01" }), inc({ id: "new", transaction_date: "2026-12-31" })],
    });
    expect(rows.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("carries amounts positive, with direction in the kind", () => {
    // A statement import can hand over a negative for money out; the tile shows
    // the sign itself, so a doubled negative would render as +R1 150.
    const rows = toBankingRows({ expenses: [exp({ amount: -1150 })] });
    expect(rows[0].amount).toBe(1150);
    expect(rows[0].kind).toBe("out");
  });

  it("names the document a row settles", () => {
    const rows = toBankingRows({
      income: [inc({ matched_invoice_id: "iv1" })],
      invoiceLabels: new Map([["iv1", "INV-0042"]]),
    });
    expect(rows[0].docLabel).toBe("INV-0042");
    expect(rows[0].allocation).toBe("matched");
  });

  it("still says matched when the invoice number cannot be looked up", () => {
    const rows = toBankingRows({ income: [inc({ matched_invoice_id: "iv1" })] });
    expect(rows[0].docLabel).toBe("Invoice");
    expect(rows[0].allocation).toBe("matched");
  });
});

describe("allocation — the state the tile has to make obvious", () => {
  it("is unallocated with no document and no category", () => {
    expect(toBankingRows({ expenses: [exp()] })[0].allocation).toBe("unallocated");
  });

  it("is categorised once a heading is set", () => {
    expect(toBankingRows({ expenses: [exp({ sars_category: "Motor vehicle — Fuel & oil" })] })[0].allocation).toBe(
      "categorised"
    );
  });

  it("prefers matched over categorised — the document is the record", () => {
    const rows = toBankingRows({
      expenses: [exp({ matched_supplier_invoice_id: "si1", sars_category: "Cost of sales — Materials" })],
    });
    expect(rows[0].allocation).toBe("matched");
  });

  it("counts a ledger match as matched too", () => {
    expect(toBankingRows({ income: [inc({ matched_ledger_entry_id: "le1" })] })[0].allocation).toBe("matched");
  });

  it("calls owner's money personal, not unallocated", () => {
    // A drawing is deliberately outside the business totals. Reading it as
    // unallocated would put a chore on the list that can never be cleared.
    expect(toBankingRows({ expenses: [exp({ is_personal: true })] })[0].allocation).toBe("personal");
  });

  it("never asks a transfer to be allocated", () => {
    expect(toBankingRows({ transfers: [tf()] })[0].allocation).toBe("transfer");
  });
});

describe("filterBanking", () => {
  const rows = toBankingRows({
    income: [inc({ sars_category: "Trading income — Services rendered" })],
    expenses: [exp(), exp({ id: "e2", paid_to: "Engen", amount: 650, reconciled_at: "2026-08-21T00:00:00Z" })],
    transfers: [tf()],
  });

  it("filters by kind", () => {
    expect(filterBanking(rows, { kind: "out" }).every((r) => r.kind === "out")).toBe(true);
    expect(filterBanking(rows, { kind: "out" })).toHaveLength(2);
  });

  it("filters to the ones needing a home", () => {
    const out = filterBanking(rows, { flag: "unallocated" });
    expect(out.every((r) => r.allocation === "unallocated")).toBe(true);
    expect(out).toHaveLength(2);
  });

  it("filters to the ones not yet agreed to the bank", () => {
    const out = filterBanking(rows, { flag: "unreconciled" });
    expect(out.some((r) => r.id === "e2")).toBe(false);
  });

  it("searches the party", () => {
    expect(filterBanking(rows, { search: "engen" }).map((r) => r.id)).toEqual(["e2"]);
  });

  it("searches the category", () => {
    expect(filterBanking(rows, { search: "services rendered" }).map((r) => r.id)).toEqual(["i1"]);
  });

  it("searches the amount, which is what people remember", () => {
    expect(filterBanking(rows, { search: "650" }).map((r) => r.id)).toEqual(["e2"]);
  });

  it("finds a transfer by an account name, its only words", () => {
    const names = (id: string | null | undefined) => (id === "acc2" ? "Savings" : "FNB Cheque");
    expect(filterBanking(rows, { search: "savings" }, names).map((r) => r.source)).toEqual(["transfer"]);
  });

  it("stacks kind and search together", () => {
    expect(filterBanking(rows, { kind: "out", search: "builders" })).toHaveLength(1);
  });

  it("keeps a transfer when filtering to either account it touches", () => {
    expect(filterBanking(rows, { accountId: "acc2" }).map((r) => r.source)).toEqual(["transfer"]);
    expect(filterBanking(rows, { accountId: "acc1", kind: "transfer" })).toHaveLength(1);
  });
});

describe("touchesAccount", () => {
  const [transfer] = toBankingRows({ transfers: [tf()] });
  it("is true on both legs of a transfer", () => {
    expect(touchesAccount(transfer, "acc1")).toBe(true);
    expect(touchesAccount(transfer, "acc2")).toBe(true);
  });
  it("is false for an account it never touched", () => {
    expect(touchesAccount(transfer, "acc9")).toBe(false);
  });
});

describe("sortBanking", () => {
  const rows = toBankingRows({
    income: [inc({ id: "i1", amount: 100, transaction_date: "2026-01-01", received_from: "Zanele" })],
    expenses: [exp({ id: "e1", amount: 900, transaction_date: "2026-06-01", paid_to: "Adams" })],
  });

  it("puts the newest first by date", () => {
    expect(sortBanking(rows, "date").map((r) => r.id)).toEqual(["e1", "i1"]);
  });

  it("puts the biggest first by amount, whichever direction", () => {
    expect(sortBanking(rows, "amount").map((r) => r.id)).toEqual(["e1", "i1"]);
  });

  it("sorts A–Z on the party", () => {
    expect(sortBanking(rows, "az").map((r) => r.id)).toEqual(["e1", "i1"]);
  });

  it("does not mutate what it was given", () => {
    const before = rows.map((r) => r.id);
    sortBanking(rows, "amount");
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});

describe("bankingTotals", () => {
  it("nets in against out", () => {
    const rows = toBankingRows({ income: [inc({ amount: 2300 })], expenses: [exp({ amount: 1150 })] });
    expect(bankingTotals(rows)).toMatchObject({ in: 2300, out: 1150, net: 1150 });
  });

  it("keeps transfers out of the net", () => {
    // R5,000 shuffled between two of your own accounts is not R5,000 of trade,
    // and folding it in would say it was.
    const rows = toBankingRows({ income: [inc({ amount: 2300 })], transfers: [tf({ amount: 5000 })] });
    const t = bankingTotals(rows);
    expect(t.net).toBe(2300);
    expect(t.transfers).toBe(5000);
  });

  it("is all zeros for an empty list", () => {
    expect(bankingTotals([] as BankingTx[])).toEqual({ in: 0, out: 0, net: 0, transfers: 0 });
  });
});
