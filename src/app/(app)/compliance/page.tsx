import { requireBusinessProfile } from "@/lib/auth";
import { ComplianceView } from "@/components/reports/ComplianceView";

export default async function CompliancePage() {
  await requireBusinessProfile();
  return <ComplianceView />;
}
