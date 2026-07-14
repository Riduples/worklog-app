import { requireBusinessProfile } from "@/lib/auth";
import { AdvancesView } from "@/components/payroll/AdvancesView";

export default async function AdvancesPage() {
  await requireBusinessProfile();
  return <AdvancesView />;
}
