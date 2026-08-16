import { describe, expect, it } from "vitest";
import { parseStaffCsvRow } from "./staffCsv";

const parse = (raw: Record<string, string>) => {
  const p = parseStaffCsvRow(raw);
  if (!p) throw new Error("row was rejected");
  return p;
};

describe("parseStaffCsvRow", () => {
  it("puts the rate in the column its pay type uses", () => {
    expect(parse({ first_name: "A", last_name: "B", pay_type: "Monthly", rate: "8500" }).row).toMatchObject({
      pay_type: "Monthly",
      monthly_salary: 8500,
      daily_wage: 0,
      hourly_rate: 0,
    });
    expect(parse({ first_name: "A", pay_type: "Hourly", rate: "75" }).row).toMatchObject({ hourly_rate: 75, monthly_salary: 0 });
    expect(parse({ first_name: "A", pay_type: "Daily", rate: "350" }).row).toMatchObject({ daily_wage: 350, hourly_rate: 0 });
  });

  it("reads a rate written the way a spreadsheet exports money", () => {
    expect(parse({ first_name: "A", pay_type: "Monthly", rate: "R 8 500,00" }).row.monthly_salary).toBe(8500);
    expect(parse({ first_name: "A", pay_type: "Monthly", rate: "12,500.50" }).row.monthly_salary).toBe(12500.5);
  });

  it("sets is_contractor and drops the tax reference for a contractor", () => {
    const { row } = parse({ first_name: "Sam", last_name: "Q", employment_type: "contractor", tax_number: "123", trading_name: "ABC cc", start_date: "2026-01-01" });
    expect(row.is_contractor).toBe(true);
    expect(row.tax_number).toBeNull();
    expect(row.trading_name).toBe("ABC cc");
    // Contractors aren't employed, so they carry no start date.
    expect(row.start_date).toBeNull();
  });

  it("accepts the spellings people actually type for worker type", () => {
    expect(parse({ first_name: "A", employment_type: "Fixed Term" }).row.employment_type).toBe("fixed_term");
    expect(parse({ first_name: "A", employment_type: "part-time" }).row.employment_type).toBe("casual");
    expect(parse({ first_name: "A", employment_type: "Subcontractor" }).row.is_contractor).toBe(true);
  });

  it("falls back to a permanent employee on an unknown worker type, and says so", () => {
    const { row, issues } = parse({ first_name: "A", employment_type: "wizard" });
    expect(row.employment_type).toBe("permanent");
    expect(issues.some((i) => i.includes("wizard"))).toBe(true);
  });

  it("falls back to Daily on an unknown pay type, and says so", () => {
    const { row, issues } = parse({ first_name: "A", pay_type: "fortnightly", rate: "100" });
    expect(row.pay_type).toBe("Daily");
    expect(row.daily_wage).toBe(100);
    expect(issues.some((i) => i.includes("fortnightly"))).toBe(true);
  });

  it("derives the date of birth from a full SA ID", () => {
    const { row } = parse({ first_name: "A", id_number: "900101 5009 08 7" });
    expect(row.id_number).toBe("9001015009087");
    expect(row.date_of_birth).toBe("1990-01-01");
  });

  it("flags a short ID rather than dropping it", () => {
    const { row, issues } = parse({ first_name: "A", id_number: "90010150" });
    expect(row.id_number).toBe("90010150");
    expect(issues.some((i) => i.includes("13 digits"))).toBe(true);
  });

  it("rejects a date that isn't YYYY-MM-DD and leaves it blank", () => {
    const { row, issues } = parse({ first_name: "A", start_date: "01/02/2026" });
    expect(row.start_date).toBeNull();
    expect(issues.some((i) => i.includes("01/02/2026"))).toBe(true);
  });

  it("warns when an employee has no start date, because leave accrues from it", () => {
    expect(parse({ first_name: "A" }).issues.some((i) => i.includes("leave won't accrue"))).toBe(true);
    // Not a contractor's problem — they accrue none.
    expect(parse({ first_name: "A", employment_type: "contractor" }).issues.some((i) => i.includes("leave won't accrue"))).toBe(false);
  });

  it("keeps a contract end date only for a fixed-term employee", () => {
    expect(parse({ first_name: "A", employment_type: "fixed_term", contract_end_date: "2026-12-31" }).row.contract_end_date).toBe("2026-12-31");
    expect(parse({ first_name: "A", employment_type: "permanent", contract_end_date: "2026-12-31" }).row.contract_end_date).toBeNull();
  });

  it("defaults days and hours the same way the form does", () => {
    expect(parse({ first_name: "A" }).row).toMatchObject({ days_per_week: 5, hours_per_day: 8 });
    expect(parse({ first_name: "A", days_per_week: "6", hours_per_day: "9" }).row).toMatchObject({ days_per_week: 6, hours_per_day: 9 });
  });

  it("splits a single name column into first and last", () => {
    const { row } = parse({ name: "Thandi Nkosi Mabaso" });
    expect(row.first_name).toBe("Thandi");
    expect(row.last_name).toBe("Nkosi Mabaso");
    expect(row.full_name).toBe("Thandi Nkosi Mabaso");
  });

  it("rejects a row with no name at all", () => {
    expect(parseStaffCsvRow({ pay_type: "Monthly", rate: "100" })).toBeNull();
  });

  it("flags a missing rate but still imports the person", () => {
    const { row, issues } = parse({ first_name: "A", pay_type: "Monthly" });
    expect(row.monthly_salary).toBe(0);
    expect(issues.some((i) => i.includes("no rate"))).toBe(true);
  });
});
