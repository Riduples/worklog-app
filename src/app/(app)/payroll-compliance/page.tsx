import { Suspense } from "react";
import { requirePlanAccess } from "@/lib/auth";
import { PayrollComplianceView } from "@/components/reports/PayrollComplianceView";

export default async function PayrollCompliancePage() {
  await requirePlanAccess("payrollcompliance");
  // Wrapped in Suspense — the view reads the ?tab= deep-link via useSearchParams.
  return (
    <Suspense>
      <PayrollComplianceView />
    </Suspense>
  );
}
