import { describe, expect, it } from "vitest";
import { buildObligations, upcomingDeadlines, type ComplianceContext } from "./compliance";

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

describe("upcoming SARS deadlines (dated + ranked)", () => {
  // 6 August 2026, local — so the next 25th is 25 Aug (19 days), the next 7th is
  // 7 Aug (1 day), and the next provisional date is 31 Aug (25 days).
  const AUG6 = new Date(2026, 7, 6);
  const at = (ctx: ComplianceContext, id: string) => {
    const o = buildObligations(ctx, AUG6).find((x) => x.id === id);
    if (!o) throw new Error(`no obligation ${id}`);
    return o;
  };

  it("gives time-bound obligations a concrete dueDate, null for once-off items", () => {
    expect(at({ ...base, hasVat: true }, "vat201").dueDate).toBe("2026-08-25");
    expect(at(base, "vat201").dueDate).toBeNull(); // not VAT registered
    expect(at(base, "provtax").dueDate).toBe("2026-08-31");
    expect(at(base, "emp201").dueDate).toBeNull(); // no employees
    expect(at(base, "popia_io").dueDate).toBeNull(); // once-off, no fixed date
  });

  it("lists only applicable deadlines within the window, soonest first", () => {
    const list = upcomingDeadlines({ ...base, hasVat: true }, 30, AUG6);
    expect(list.map((d) => d.obligation.id)).toEqual(["vat201", "provtax"]); // 25 Aug before 31 Aug
    expect(list[0]!.daysLeft).toBe(19);
    expect(list.map((d) => d.obligation.id)).not.toContain("emp201"); // no employees → excluded
  });

  it("respects the window", () => {
    // provtax (25 days out) drops when the window is 20 days.
    expect(upcomingDeadlines({ ...base, hasVat: true }, 20, AUG6).map((d) => d.obligation.id)).toEqual(["vat201"]);
  });

  it("surfaces EMP201 the moment there's an employee", () => {
    const list = upcomingDeadlines({ ...base, hasEmployees: true, employeeCount: 1, hasPaye: true }, 10, AUG6);
    const emp = list.find((d) => d.obligation.id === "emp201");
    expect(emp).toBeTruthy();
    expect(emp!.daysLeft).toBe(1); // 7 Aug
  });
});
