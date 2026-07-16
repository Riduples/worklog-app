import { requireBusinessProfile } from "@/lib/auth";
import { TaxJarView } from "@/components/reports/TaxJarView";

export default async function TaxJarPage() {
  await requireBusinessProfile();
  return <TaxJarView />;
}
