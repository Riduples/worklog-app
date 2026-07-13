import { requireBusinessProfile } from "@/lib/auth";
import { TaxView } from "@/components/reports/TaxView";

export default async function TaxPage() {
  await requireBusinessProfile();
  return <TaxView />;
}
