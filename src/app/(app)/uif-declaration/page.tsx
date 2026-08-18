import { requirePlanAccess } from "@/lib/auth";
import { Uif201View } from "@/components/reports/Uif201View";

export default async function UifDeclarationPage() {
  await requirePlanAccess("payrollcompliance");
  return <Uif201View />;
}
