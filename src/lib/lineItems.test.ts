import { describe, expect, it } from "vitest";
import { salesLineTotal, salesLinesSubtotal } from "./lineItems";

describe("salesLineTotal", () => {
  it("uses qty × unit_price for a new-model line", () => {
    expect(salesLineTotal({ desc: "Tiling", qty: 3, unit_price: 150 })).toBe(450);
  });
  it("defaults qty to 1 when absent on a unit-price line", () => {
    expect(salesLineTotal({ unit_price: 150 })).toBe(150);
  });
  it("falls back to labour + materials for a historic line (qty not applied)", () => {
    // Old model ignored qty in the total, so a qty of 3 must NOT change it.
    expect(salesLineTotal({ desc: "Job", qty: 3, labour: 200, materials: 100 })).toBe(300);
  });
  it("prefers unit_price when both are somehow present", () => {
    expect(salesLineTotal({ qty: 2, unit_price: 50, labour: 999, materials: 999 })).toBe(100);
  });
  it("treats a zero unit_price as a real value, not absent", () => {
    expect(salesLineTotal({ qty: 5, unit_price: 0 })).toBe(0);
  });
});

describe("salesLinesSubtotal", () => {
  it("sums a mix of new and historic lines", () => {
    expect(
      salesLinesSubtotal([
        { qty: 2, unit_price: 100 }, // 200
        { labour: 50, materials: 25 }, // 75
      ])
    ).toBe(275);
  });
});
