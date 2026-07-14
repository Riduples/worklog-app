import { requireBusinessProfile } from "@/lib/auth";
import { PayRunView } from "@/components/payroll/PayRunView";

export default async function PayrollPage() {
  await requireBusinessProfile();
  return <PayRunView />;
}
