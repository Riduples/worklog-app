import type { Tables } from "@/lib/types/database";
import { ageFromSaId } from "@/lib/saId";

// Employment Tax Incentive (ETI) — lets an employer reduce PAYE for young
// (18–29) employees earning under R7,500/month. This is an ESTIMATE + eligibility
// flag, not a full compliant engine (no part-time gross-up, minimum-wage
// validation, or 12-qualifying-month tracking) — it surfaces the opportunity and
// the rand value; the accountant confirms and claims it on the EMP201.
//
// Bands effective 1 April 2025 (SARS, budget-confirmed). ETI values are reviewed
// each budget — revisit these numbers annually.

type EtiStaff = Pick<Tables<"staff_register">, "date_of_birth" | "id_number" | "is_contractor">;

export type EtiResult =
  | { eligible: false; reason: string; age?: number | null; needsInfo?: boolean }
  | { eligible: true; amount: number; age: number; tier: string };

/** Whole months between a start date and a reference date (default: today). */
export function monthsEmployedFrom(startDate: string | null | undefined, asOf?: Date): number {
  if (!startDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const now = asOf ?? new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months--;
  return Math.max(0, months);
}

/** Estimated monthly remuneration from the pay type + rate (for the ETI estimate
 *  shown on a staff profile; the EMP201 uses each run's actual gross instead). */
export function monthlyRemunerationOf(
  staff: Pick<Tables<"staff_register">, "pay_type" | "daily_wage" | "hourly_rate" | "monthly_salary" | "days_per_week" | "hours_per_day">
): number {
  const daysPerMonth = (staff.days_per_week ?? 5) * 4.33;
  if (staff.pay_type === "Monthly") return staff.monthly_salary ?? 0;
  if (staff.pay_type === "Hourly") return (staff.hourly_rate ?? 0) * (staff.hours_per_day ?? 8) * daysPerMonth;
  return (staff.daily_wage ?? 0) * daysPerMonth;
}

/** Age from the stored date of birth, falling back to the SA ID number. */
function ageOf(staff: Pick<Tables<"staff_register">, "date_of_birth" | "id_number">, asOf?: Date): number | null {
  if (staff.date_of_birth) {
    const b = new Date(`${staff.date_of_birth}T00:00:00`);
    const n = asOf ?? new Date();
    let a = n.getFullYear() - b.getFullYear();
    if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
    return a;
  }
  return ageFromSaId(staff.id_number, asOf);
}

export function calcETI(staff: EtiStaff, monthlyRemuneration: number, monthsEmployed: number, asOf?: Date): EtiResult {
  if (staff.is_contractor) return { eligible: false, reason: "Contractors don't qualify" };
  const age = ageOf(staff, asOf);
  const rem = Number(monthlyRemuneration) || 0;

  if (age == null) return { eligible: false, reason: "Add the worker's SA ID or date of birth to check ETI eligibility", needsInfo: true };
  if (age < 18 || age > 29) return { eligible: false, reason: `Age ${age} — ETI is for ages 18–29`, age };
  if (rem >= 7500) return { eligible: false, reason: "Earns R7,500+/month — above the ETI ceiling", age };
  if (rem <= 0) return { eligible: false, reason: "No remuneration entered", age };
  if (!staff.id_number) return { eligible: false, reason: "ETI needs a valid SA ID on record", age, needsInfo: true };

  const secondYear = (monthsEmployed || 0) >= 12;
  let eti: number;
  if (rem < 2500) {
    eti = rem * (secondYear ? 0.3 : 0.6);
  } else if (rem <= 5500) {
    eti = secondYear ? 1250 : 2500;
  } else {
    const a = secondYear ? 1250 : 2500;
    const b = secondYear ? 0.625 : 1.25;
    eti = Math.max(0, a - b * (rem - 5500));
  }
  return { eligible: true, amount: Math.round(eti * 100) / 100, age, tier: secondYear ? "second 12 months" : "first 12 months" };
}
