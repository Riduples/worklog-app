import { requireBusinessProfile } from "@/lib/auth";
import { PriceListReportsView } from "@/components/reports/PriceListReportsView";

export default async function PriceListReportsPage() {
  await requireBusinessProfile();
  return <PriceListReportsView />;
}
