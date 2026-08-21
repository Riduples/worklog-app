import { requirePlanAccess } from "@/lib/auth";
import { RemittanceView } from "@/components/purchases/RemittanceView";

export default async function RemittancePage() {
  // Remittance is a Trade+ tool, padlocked in the nav — gate the page too, or a
  // Solo user reaches the full tool by direct URL (every sibling gates this way).
  await requirePlanAccess("remittance");
  return <RemittanceView />;
}
