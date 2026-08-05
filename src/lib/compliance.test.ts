import { describe, expect, it } from "vitest";
import { buildObligations, type ComplianceContext } from "./compliance";

// The bug these guard: before the entity type was persisted, buildObligations was
// blind to legal form, so a sole proprietor was shown CIPC returns they never owe
// and everyone got the same "Annual Income Tax (ITR12 / ITR14)" catch-all. These
// assert the obligations now follow the classification.

const base: ComplianceContext = {
  hasVat: false,
  hasPaye: false,
  hasEmployees: false,
  employeeCount: 0,
  annualIncome: 100_000,
  lastVat201Date: null,
  lastEmp201Date: null,
  entityType: null,
  onTurnoverTax: false,
};

const find = (ctx: ComplianceContext, id: string) => {
  const o = buildObligations(ctx).find((x) => x.id === id);
  if (!o) throw new Error(`no obligation ${id}`);
  return o;
};

describe("compliance obligations follow the SARS entity type", () => {
  it("marks CIPC returns not-applicable for a sole proprietor", () => {
    const ctx = { ...base, entityType: "sole_proprietor" as const };
    expect(find(ctx, "cipc_ar").status).toBe("na");
    expect(find(ctx, "beneficial").status).toBe("na");
  });

  it("keeps CIPC returns live for a company", () => {
    expect(find({ ...base, entityType: "company" }, "cipc_ar").status).toBe("elsewhere");
  });

  it("leaves CIPC returns showing when the form is unknown (no guessing)", () => {
    expect(find(base, "cipc_ar").status).toBe("elsewhere");
  });

  it("names the correct annual return for each form", () => {
    expect(find({ ...base, entityType: "company" }, "annualtax").title).toContain("ITR14");
    expect(find({ ...base, entityType: "sole_proprietor" }, "annualtax").title).toContain("ITR12");
    expect(find({ ...base, entityType: "trust" }, "annualtax").title).toContain("IT12TR");
  });

  it("switches provisional & annual tax to Turnover Tax forms when registered", () => {
    const ctx = { ...base, entityType: "sole_proprietor" as const, onTurnoverTax: true };
    expect(find(ctx, "provtax").title).toContain("TT02");
    expect(find(ctx, "annualtax").title).toContain("TT03");
  });

  it("still requires VAT registration above the R1m threshold", () => {
    expect(find({ ...base, annualIncome: 1_500_000 }, "vat201").status).toBe("register");
  });
});
