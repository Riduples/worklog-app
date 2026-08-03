import { requirePlanAccess } from "@/lib/auth";
import { AgeAnalysisView } from "@/components/reports/AgeAnalysisView";

export default async function AgeAnalysisPayablesPage() {
  await requirePlanAccess("ageanalysis");
  return <AgeAnalysisView side="creditors" />;
}
