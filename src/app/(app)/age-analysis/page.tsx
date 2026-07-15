import { requireBusinessProfile } from "@/lib/auth";
import { AgeAnalysisView } from "@/components/reports/AgeAnalysisView";

export default async function AgeAnalysisPage() {
  await requireBusinessProfile();
  return <AgeAnalysisView />;
}
