import { describe, expect, it } from "vitest";
import {
  TAX_ENTITY_TYPES,
  annualReturnForm,
  canQualifySbc,
  isCompanyLike,
  isIndividuallyTaxed,
  registeredWithCipc,
} from "./entityTypes";

// These encode the SARS classification rules the rest of the app leans on — which
// forms are taxed as companies, which can elect the SBC scale, which owe CIPC
// returns, and which annual return each files. Written against the rules, not the
// current output, so a wrong mapping can't pass quietly.

describe("entity classification helpers", () => {
  it("treats companies, CCs and co-ops as company-like", () => {
    expect(isCompanyLike("company")).toBe(true);
    expect(isCompanyLike("close_corporation")).toBe(true);
    expect(isCompanyLike("co_operative")).toBe(true);
    expect(isCompanyLike("sole_proprietor")).toBe(false);
    expect(isCompanyLike("partnership")).toBe(false);
    expect(isCompanyLike("trust")).toBe(false);
    expect(isCompanyLike(null)).toBe(false);
  });

  it("taxes sole proprietors and partners as individuals", () => {
    expect(isIndividuallyTaxed("sole_proprietor")).toBe(true);
    expect(isIndividuallyTaxed("partnership")).toBe(true);
    expect(isIndividuallyTaxed("company")).toBe(false);
    expect(isIndividuallyTaxed("trust")).toBe(false);
  });

  it("only lets a company / CC / co-op qualify as an SBC", () => {
    expect(canQualifySbc("company")).toBe(true);
    expect(canQualifySbc("close_corporation")).toBe(true);
    expect(canQualifySbc("co_operative")).toBe(true);
    expect(canQualifySbc("sole_proprietor")).toBe(false);
    expect(canQualifySbc("partnership")).toBe(false);
    expect(canQualifySbc("trust")).toBe(false);
    expect(canQualifySbc(null)).toBe(false);
  });

  it("owes CIPC returns only for incorporated forms", () => {
    expect(registeredWithCipc("company")).toBe(true);
    expect(registeredWithCipc("close_corporation")).toBe(true);
    expect(registeredWithCipc("co_operative")).toBe(true);
    expect(registeredWithCipc("sole_proprietor")).toBe(false);
    expect(registeredWithCipc("partnership")).toBe(false);
    expect(registeredWithCipc("trust")).toBe(false);
  });

  it("maps each form to its SARS annual return", () => {
    expect(annualReturnForm("company")).toBe("ITR14");
    expect(annualReturnForm("close_corporation")).toBe("ITR14");
    expect(annualReturnForm("co_operative")).toBe("ITR14");
    expect(annualReturnForm("trust")).toBe("IT12TR");
    expect(annualReturnForm("sole_proprietor")).toBe("ITR12");
    expect(annualReturnForm("partnership")).toBe("ITR12");
    expect(annualReturnForm(null)).toBe("ITR12"); // unset → the owner's personal return
  });

  it("lists every entity type with a unique id and populated copy", () => {
    const ids = TAX_ENTITY_TYPES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of TAX_ENTITY_TYPES) {
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.short.length).toBeGreaterThan(0);
      expect(e.desc.length).toBeGreaterThan(0);
    }
  });
});
