import { requirePlanAccess } from "@/lib/auth";
import { StatementView } from "@/components/sales/StatementView";

export default async function StatementPage() {
  // Statements are a Trade+ tool, padlocked in the nav — gate the page too, or a
  // Solo user reaches the full tool by direct URL (every sibling gates this way).
  await requirePlanAccess("statement");
  return <StatementView />;
}
