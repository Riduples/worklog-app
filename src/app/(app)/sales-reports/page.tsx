import { requireBusinessProfile } from "@/lib/auth";
import { SalesReportsView } from "@/components/reports/SalesReportsView";

export default async function SalesReportsPage() {
  await requireBusinessProfile();
  return <SalesReportsView />;
}
