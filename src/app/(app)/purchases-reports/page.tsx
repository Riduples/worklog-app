import { requireBusinessProfile } from "@/lib/auth";
import { PurchasesReportsView } from "@/components/reports/PurchasesReportsView";

export default async function PurchasesReportsPage() {
  await requireBusinessProfile();
  return <PurchasesReportsView />;
}
