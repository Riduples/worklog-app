import { requireBusinessProfile } from "@/lib/auth";
import { PayrollReportsView } from "@/components/reports/PayrollReportsView";

export default async function PayrollReportsPage() {
  await requireBusinessProfile();
  return <PayrollReportsView />;
}
