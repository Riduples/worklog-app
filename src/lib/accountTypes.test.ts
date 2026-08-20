import { describe, expect, it } from "vitest";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_META, methodsForAccountType, normaliseAccountType } from "./accountTypes";
import { EXPENSE_PAYMENT_METHODS, INCOME_PAYMENT_METHODS } from "./sarsCategories";

describe("normaliseAccountType", () => {
  it("takes the stored ids straight through", () => {
    for (const t of ACCOUNT_TYPES) expect(normaliseAccountType(t)).toBe(t);
  });

  it("reads what someone would actually type into a spreadsheet", () => {
    expect(normaliseAccountType("Cheque")).toBe("bank");
    expect(normaliseAccountType("credit card")).toBe("credit");
    expect(normaliseAccountType("Petty cash")).toBe("cash");
    expect(normaliseAccountType("Money market")).toBe("savings");
  });

  it("falls back to bank rather than dropping the row", () => {
    expect(normaliseAccountType("")).toBe("bank");
    expect(normaliseAccountType(undefined)).toBe("bank");
    expect(normaliseAccountType("something else entirely")).toBe("bank");
  });
});

describe("methodsForAccountType", () => {
  it("offers a cash account only what a cash box can do, plus the Other escape hatch", () => {
    expect(methodsForAccountType("cash")).toEqual(["Cash", "Voucher / Gift card", "Other"]);
  });

  it("never offers cash on a card account", () => {
    expect(methodsForAccountType("credit")).not.toContain("Cash");
  });

  it("keeps every type's methods inside the list the log forms actually show", () => {
    // The point of the whole module: the words on this screen and the chips on
    // Log income / Log expense are the same vocabulary, so neither can drift.
    for (const t of ACCOUNT_TYPES) {
      for (const m of methodsForAccountType(t)) {
        expect(EXPENSE_PAYMENT_METHODS.includes(m) || INCOME_PAYMENT_METHODS.includes(m)).toBe(true);
      }
    }
  });

  it("narrows nothing for an unknown type", () => {
    expect(methodsForAccountType("other")).toEqual([...EXPENSE_PAYMENT_METHODS]);
  });
});

describe("ACCOUNT_TYPE_META", () => {
  it("names every type the pills can show", () => {
    for (const t of ACCOUNT_TYPES) {
      expect(ACCOUNT_TYPE_META[t].label).toBeTruthy();
      expect(ACCOUNT_TYPE_META[t].icon).toBeTruthy();
      expect(ACCOUNT_TYPE_META[t].hint).toBeTruthy();
    }
  });
});
