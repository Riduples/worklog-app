import { requirePlanAccess } from "@/lib/auth";
import { ProvTaxView } from "@/components/reports/ProvTaxView";

export default async function ProvTaxPage() {
  await requirePlanAccess("provtax");
  return <ProvTaxView />;
}
