import { requirePlanAccess } from "@/lib/auth";
import { AdvancesView } from "@/components/payroll/AdvancesView";

export default async function AdvancesPage() {
  await requirePlanAccess("advances");
  return <AdvancesView />;
}
