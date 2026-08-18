import { requirePlanAccess } from "@/lib/auth";
import { CoidaView } from "@/components/reports/CoidaView";

export default async function CoidaRoePage() {
  await requirePlanAccess("payrollcompliance");
  return <CoidaView />;
}
