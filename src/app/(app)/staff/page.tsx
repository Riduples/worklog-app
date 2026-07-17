import { requirePlanAccess } from "@/lib/auth";
import { StaffView } from "@/components/staff/StaffView";

export default async function StaffPage() {
  await requirePlanAccess("staffregister");
  return <StaffView />;
}
