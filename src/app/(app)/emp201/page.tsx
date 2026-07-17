import { requirePlanAccess } from "@/lib/auth";
import { Emp201View } from "@/components/reports/Emp201View";

export default async function Emp201Page() {
  await requirePlanAccess("emp201");
  return <Emp201View />;
}
