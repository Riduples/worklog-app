import { requireBusinessProfile } from "@/lib/auth";
import { StatementView } from "@/components/sales/StatementView";

export default async function StatementPage() {
  await requireBusinessProfile();
  return <StatementView />;
}
