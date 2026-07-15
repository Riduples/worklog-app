import { requireBusinessProfile } from "@/lib/auth";
import { ProvTaxView } from "@/components/reports/ProvTaxView";

export default async function ProvTaxPage() {
  await requireBusinessProfile();
  return <ProvTaxView />;
}
