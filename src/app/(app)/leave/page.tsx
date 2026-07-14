import { requireBusinessProfile } from "@/lib/auth";
import { LeaveView } from "@/components/payroll/LeaveView";

export default async function LeavePage() {
  await requireBusinessProfile();
  return <LeaveView />;
}
