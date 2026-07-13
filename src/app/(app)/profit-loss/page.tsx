import { requireBusinessProfile } from "@/lib/auth";
import { ProfitLossView } from "@/components/reports/ProfitLossView";

export default async function ProfitLossPage() {
  await requireBusinessProfile();
  return <ProfitLossView />;
}
