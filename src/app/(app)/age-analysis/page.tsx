import { requirePlanAccess } from "@/lib/auth";
import { AgeAnalysisView } from "@/components/reports/AgeAnalysisView";

export default async function AgeAnalysisPage() {
  await requirePlanAccess("ageanalysis");
  return <AgeAnalysisView />;
}
