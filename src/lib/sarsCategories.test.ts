import { describe, expect, it } from "vitest";
import { findSarsCategory, getSarsMatch, getSarsIncomeMatch } from "@/lib/sarsCategories";

// Rows store the `sars` account name, screens show the plain-English `label`, so
// anything editing a saved category has to resolve one back to the other. A miss
// here shows a category field that looks empty over a value that is really set —
// and saving then wipes a category the user never meant to clear.
describe("findSarsCategory", () => {
  it("resolves an expense account name to its friendly label", () => {
    expect(findSarsCategory("Premises — Water & municipal rates")?.label).toBe("Water & rates");
  });

  it("resolves an income account name too — callers hold a string, not a side", () => {
    expect(findSarsCategory("Other income — Interest received")?.label).toBe("Interest received");
  });

  it("with a direction, only that side resolves — so an import can't file out under income", () => {
    // A money-out row must never pick up an income heading, or vice versa.
    expect(findSarsCategory("Motor vehicle — Fuel & oil", "out")?.label).toBe("Fuel & oil");
    expect(findSarsCategory("Motor vehicle — Fuel & oil", "in")).toBeNull();
    expect(findSarsCategory("Trading income — Services rendered", "in")).not.toBeNull();
    expect(findSarsCategory("Trading income — Services rendered", "out")).toBeNull();
  });

  it("is null for nothing set, so an unset field stays unset", () => {
    expect(findSarsCategory(null)).toBeNull();
    expect(findSarsCategory(undefined)).toBeNull();
    expect(findSarsCategory("")).toBeNull();
  });

  it("is null for a value that matches no category", () => {
    // A label rather than an account name: close, but not what is stored.
    expect(findSarsCategory("Water & rates")).toBeNull();
    expect(findSarsCategory("Something nobody ships")).toBeNull();
  });

  it("round-trips every suggestion the pickers can offer", () => {
    // The contract between the two halves: anything a dropdown can hand back must
    // resolve again when the record is reopened for editing.
    for (const text of ["fuel", "rent", "insurance", "interest", "commission", "stock"]) {
      for (const c of [...getSarsMatch(text), ...getSarsIncomeMatch(text)]) {
        expect(findSarsCategory(c.sars)).not.toBeNull();
      }
    }
  });
});

describe("category search", () => {
  it("matches on the friendly label", () => {
    expect(getSarsMatch("water").map((c) => c.label)).toContain("Water & rates");
  });

  it("matches on the SARS account name", () => {
    expect(getSarsMatch("municipal").map((c) => c.label)).toContain("Water & rates");
  });

  it("matches on the group, so browsing a heading works", () => {
    expect(getSarsMatch("motor vehicle").length).toBeGreaterThan(1);
  });

  it("keeps income and expense apart — a price list never offers 'Fuel & oil'", () => {
    expect(getSarsIncomeMatch("fuel")).toEqual([]);
    expect(getSarsMatch("fuel").length).toBeGreaterThan(0);
  });

  it("stays quiet under two characters, so the dropdown doesn't flash on every keystroke", () => {
    expect(getSarsMatch("f")).toEqual([]);
    expect(getSarsMatch("")).toEqual([]);
  });

  it("caps suggestions at six so the dropdown never covers the form", () => {
    expect(getSarsMatch("e").length).toBeLessThanOrEqual(6);
    expect(getSarsMatch("cost").length).toBeLessThanOrEqual(6);
  });
});
