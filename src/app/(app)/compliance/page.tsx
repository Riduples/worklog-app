import { requirePlanAccess } from "@/lib/auth";
import { ComplianceView } from "@/components/reports/ComplianceView";

export default async function CompliancePage() {
  await requirePlanAccess("compliance");
  return <ComplianceView />;
}
