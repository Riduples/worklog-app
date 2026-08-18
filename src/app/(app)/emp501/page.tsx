import { requirePlanAccess } from "@/lib/auth";
import { Emp501View } from "@/components/reports/Emp501View";

export default async function Emp501Page() {
  await requirePlanAccess("payrollcompliance");
  return <Emp501View />;
}
