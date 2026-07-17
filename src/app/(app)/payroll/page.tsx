import { requirePlanAccess } from "@/lib/auth";
import { PayRunView } from "@/components/payroll/PayRunView";

export default async function PayrollPage() {
  await requirePlanAccess("payrun");
  return <PayRunView />;
}
