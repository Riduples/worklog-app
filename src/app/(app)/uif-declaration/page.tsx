import { redirect } from "next/navigation";
import { requirePlanAccess } from "@/lib/auth";

// The UIF declaration lives inside the Payroll Compliance hub now — this old
// route just forwards there so existing links keep working without a duplicate
// screen.
export default async function UifDeclarationPage() {
  await requirePlanAccess("payrollcompliance");
  redirect("/payroll-compliance?tab=uif");
}
