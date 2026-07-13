import { requireBusinessProfile } from "@/lib/auth";
import { CashFlowView } from "@/components/reports/CashFlowView";

export default async function CashFlowPage() {
  await requireBusinessProfile();
  return <CashFlowView />;
}
