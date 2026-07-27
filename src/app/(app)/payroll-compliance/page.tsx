import { requirePlanAccess } from "@/lib/auth";
import { PayrollComplianceView } from "@/components/reports/PayrollComplianceView";

export default async function PayrollCompliancePage() {
  await requirePlanAccess("payrollcompliance");
  return <PayrollComplianceView />;
}
