// Turning a row of a staff CSV into the exact shape the Add Staff form saves.
//
// Kept pure and out of the import modal because this mapping is the whole point
// of the feature: a spreadsheet says "Monthly / 8500" where the register keeps
// three separate rate columns, "contractor" has to set is_contractor, and the
// date of birth is derived from the ID rather than typed. Getting any of that
// wrong writes a staff member who then pays out wrong, so it's unit-tested.

import { dobFromSaId } from "@/lib/saId";
import { parseCsvNumber } from "@/lib/csvTemplates";
import type { TablesInsert } from "@/lib/types/database";

export type StaffCsvRow = Omit<TablesInsert<"staff_register">, "user_id" | "business_id">;

export const CSV_EMPLOYMENT_TYPES = ["permanent", "fixed_term", "casual", "contractor"] as const;
export const CSV_PAY_TYPES = ["Daily", "Hourly", "Monthly"] as const;

const num = (v: unknown) => parseCsvNumber(v);

const text = (v: unknown) => String(v ?? "").trim();

/** Accepts "fixed_term", "fixed term", "Fixed-Term" — all the same thing. */
function normaliseEmploymentType(raw: string): (typeof CSV_EMPLOYMENT_TYPES)[number] | null {
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return null;
  const direct = CSV_EMPLOYMENT_TYPES.find((t) => t === key);
  if (direct) return direct;
  // The words people actually type in a spreadsheet.
  if (["employee", "full_time", "fulltime", "perm"].includes(key)) return "permanent";
  if (["fixed", "contract_employee", "temp", "temporary"].includes(key)) return "fixed_term";
  if (["part_time", "parttime", "casual_worker"].includes(key)) return "casual";
  if (["independent_contractor", "subcontractor", "sub_contractor", "freelancer"].includes(key)) return "contractor";
  return null;
}

function normalisePayType(raw: string): (typeof CSV_PAY_TYPES)[number] | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  if (["daily", "day", "per day", "day rate"].includes(key)) return "Daily";
  if (["hourly", "hour", "per hour", "hour rate"].includes(key)) return "Hourly";
  if (["monthly", "month", "per month", "salary", "salaried"].includes(key)) return "Monthly";
  return null;
}

/** YYYY-MM-DD only — the format the template ships and every date input uses. */
const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());

export type ParsedStaffCsvRow = { row: StaffCsvRow; name: string; issues: string[] };

/**
 * Map one CSV record onto a staff_register insert.
 *
 * Never rejects a row for a bad optional value: an unrecognised worker type or
 * pay type falls back to the same default the Add form opens on and says so, so
 * an import of 40 people isn't stopped by one odd spelling. Returns null only
 * when there's no name, which is not a person.
 */
export function parseStaffCsvRow(raw: Record<string, string>): ParsedStaffCsvRow | null {
  const first = text(raw.first_name);
  const last = text(raw.last_name);
  // A single "name" column is what you get exporting from most other systems.
  const fallback = text(raw.name || raw.full_name);
  const [fbFirst, ...fbRest] = fallback.split(/\s+/);
  const firstName = first || fbFirst || "";
  const lastName = last || fbRest.join(" ");
  if (!firstName) return null;

  const issues: string[] = [];

  const rawType = text(raw.employment_type);
  const employmentType = normaliseEmploymentType(rawType);
  if (rawType && !employmentType) issues.push(`worker type "${rawType}" not recognised — imported as a permanent employee`);
  const finalType = employmentType ?? "permanent";
  const isContractor = finalType === "contractor";

  const rawPay = text(raw.pay_type);
  const payType = normalisePayType(rawPay);
  if (rawPay && !payType) issues.push(`pay type "${rawPay}" not recognised — imported as Daily`);
  const finalPay = payType ?? "Daily";

  const rate = num(raw.rate);
  if (rate <= 0) issues.push("no rate — imports as R0, so set it before their first pay run");

  const startDate = text(raw.start_date);
  if (startDate && !isIsoDate(startDate)) issues.push(`start date "${startDate}" isn't YYYY-MM-DD — left blank`);
  // A start date is what leave accrues from, so a missing one is worth saying out
  // loud rather than quietly defaulting to today and inventing service.
  const validStart = isIsoDate(startDate) ? startDate : "";
  if (!isContractor && !validStart) issues.push("no start date — leave won't accrue until you add one");

  const contractEnd = text(raw.contract_end_date);
  if (contractEnd && !isIsoDate(contractEnd)) issues.push(`contract end date "${contractEnd}" isn't YYYY-MM-DD — left blank`);

  // Digits only, 13 long, same as the form's own input filter.
  const idNumber = text(raw.id_number).replace(/\D/g, "").slice(0, 13);
  if (idNumber && idNumber.length < 13) issues.push("SA ID isn't 13 digits — imported as typed, but ETI and date of birth need a full one");

  const daysPerWeek = num(raw.days_per_week) || 5;
  const hoursPerDay = num(raw.hours_per_day) || 8;

  const row: StaffCsvRow = {
    full_name: `${firstName} ${lastName}`.trim(),
    first_name: firstName,
    last_name: lastName,
    employment_type: finalType,
    is_contractor: isContractor,
    trading_name: isContractor ? text(raw.trading_name) || null : null,
    id_number: idNumber || null,
    // Contractors file their own tax, so the form never stores a tax reference
    // for them and neither does this.
    tax_number: !isContractor ? text(raw.tax_number) || null : null,
    contact_number: text(raw.contact_number) || null,
    date_of_birth: dobFromSaId(idNumber),
    address: text(raw.address) || null,
    bank_name: text(raw.bank_name) || null,
    bank_account: text(raw.bank_account) || null,
    start_date: !isContractor && validStart ? validStart : null,
    contract_end_date: finalType === "fixed_term" && isIsoDate(contractEnd) ? contractEnd : null,
    pay_type: finalPay,
    daily_wage: finalPay === "Daily" ? rate : 0,
    hourly_rate: finalPay === "Hourly" ? rate : 0,
    monthly_salary: finalPay === "Monthly" ? rate : 0,
    days_per_week: daysPerWeek,
    hours_per_day: hoursPerDay,
    recurring_allowance: num(raw.recurring_allowance),
    recurring_allowance_desc: text(raw.recurring_allowance_desc) || null,
  };

  return { row, name: row.full_name, issues };
}
