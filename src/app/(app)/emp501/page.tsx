import { redirect } from "next/navigation";
import { requirePlanAccess } from "@/lib/auth";

// EMP501 lives inside the Payroll Compliance hub now — forward there so existing
// links keep working without a duplicate screen.
export default async function Emp501Page() {
  await requirePlanAccess("payrollcompliance");
  redirect("/payroll-compliance?tab=emp501");
}
