import { describe, expect, it } from "vitest";
import { computeSetupSteps, type SetupInput } from "./setupChecklist";

const empty: SetupInput = { business: null, accountCount: 0, hasMoneyLogged: false, invoiceCount: 0 };

describe("computeSetupSteps", () => {
  it("marks every step undone for a brand-new business", () => {
    const steps = computeSetupSteps(empty);
    expect(steps).toHaveLength(5);
    expect(steps.every((s) => !s.done)).toBe(true);
  });

  it("ticks off each step from its own data", () => {
    const s = computeSetupSteps({
      business: { bank_name: "FNB", vat_number: "4123456789" },
      accountCount: 1,
      hasMoneyLogged: true,
      invoiceCount: 2,
    });
    const done = (key: string) => s.find((x) => x.key === key)!.done;
    expect(done("details")).toBe(true); // bank_name filled in
    expect(done("account")).toBe(true);
    expect(done("money")).toBe(true);
    expect(done("invoice")).toBe(true);
    expect(done("tax")).toBe(true); // vat_number set
  });

  it("details needs more than a name; tax accepts VAT or entity type", () => {
    const s = computeSetupSteps({
      business: { address: null, logo_url: null, bank_name: null, tax_entity_type: "company" },
      accountCount: 0,
      hasMoneyLogged: false,
      invoiceCount: 0,
    });
    expect(s.find((x) => x.key === "details")!.done).toBe(false); // no address/logo/bank yet
    expect(s.find((x) => x.key === "tax")!.done).toBe(true); // entity type is enough
  });

  it("each step maps to a navigable target", () => {
    expect(computeSetupSteps(empty).map((x) => x.target)).toEqual(["business", "accounts", "quicklog", "invoices", "business"]);
  });
});
