import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { CSV_TEMPLATES, buildTemplateCsv, type CsvImportType } from "./csvTemplates";
import { parseStaffCsvRow } from "./staffCsv";

const TYPES: CsvImportType[] = ["stock", "client", "supplier", "staff"];

describe("buildTemplateCsv", () => {
  // The template is the thing users download, fill in and upload again, so it
  // has to survive that round trip. It didn't: a sample address with a comma in
  // it was written unquoted and shifted every column after it.
  it.each(TYPES)("round-trips through the parser we import with (%s)", (type) => {
    const parsed = Papa.parse<Record<string, string>>(buildTemplateCsv(type), { header: true, skipEmptyLines: true });
    expect(parsed.errors).toEqual([]);
    expect(parsed.data).toHaveLength(1);

    const headers = CSV_TEMPLATES[type].columns.map((c) => c.csvHeader);
    expect(Object.keys(parsed.data[0])).toEqual(headers);
    for (const h of headers) {
      expect(parsed.data[0][h]).toBe(CSV_TEMPLATES[type].sampleRow[h] ?? "");
    }
  });

  it("quotes a value containing a comma rather than splitting the row", () => {
    expect(buildTemplateCsv("client")).toContain('"12 Main St, Johannesburg"');
  });

  it.each(TYPES)("gives every column a sample value or an empty one (%s)", (type) => {
    for (const c of CSV_TEMPLATES[type].columns) {
      expect(CSV_TEMPLATES[type].sampleRow).toHaveProperty(c.csvHeader);
    }
  });
});

describe("the staff template matches the staff register", () => {
  // The point of the feature: the template's columns are the fields the Add
  // Staff form saves. If a column is renamed here and not in the parser, the
  // template silently stops importing that field — this catches that.
  it("imports its own sample row into a complete staff member", () => {
    const parsed = Papa.parse<Record<string, string>>(buildTemplateCsv("staff"), { header: true, skipEmptyLines: true });
    const result = parseStaffCsvRow(parsed.data[0]);
    expect(result).not.toBeNull();
    expect(result!.row).toMatchObject({
      full_name: "Sipho Dlamini",
      first_name: "Sipho",
      last_name: "Dlamini",
      employment_type: "permanent",
      is_contractor: false,
      pay_type: "Monthly",
      monthly_salary: 8500,
      days_per_week: 5,
      hours_per_day: 8,
      start_date: "2026-01-15",
      recurring_allowance: 500,
      recurring_allowance_desc: "Travel",
      id_number: "9001015009087",
      date_of_birth: "1990-01-01",
      tax_number: "1234567890",
      contact_number: "0821234567",
      address: "12 Main St, Johannesburg",
      bank_name: "FNB",
      bank_account: "62012345678",
    });
  });

  it("has nothing left to flag on its own sample row", () => {
    const parsed = Papa.parse<Record<string, string>>(buildTemplateCsv("staff"), { header: true, skipEmptyLines: true });
    expect(parseStaffCsvRow(parsed.data[0])!.issues).toEqual([]);
  });
});
