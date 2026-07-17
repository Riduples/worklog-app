import { requirePlanAccess } from "@/lib/auth";
import { LeaveView } from "@/components/payroll/LeaveView";

export default async function LeavePage() {
  await requirePlanAccess("leave");
  return <LeaveView />;
}
