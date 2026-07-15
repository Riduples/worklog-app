import { requireBusinessProfile } from "@/lib/auth";
import { RemittanceView } from "@/components/purchases/RemittanceView";

export default async function RemittancePage() {
  await requireBusinessProfile();
  return <RemittanceView />;
}
