import { redirect } from "next/navigation";
import { requirePlanAccess } from "@/lib/auth";

// COIDA lives inside the Payroll Compliance hub now — forward there so existing
// links keep working without a duplicate screen.
export default async function CoidaRoePage() {
  await requirePlanAccess("payrollcompliance");
  redirect("/payroll-compliance?tab=coida");
}
