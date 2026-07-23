import { requirePlatformAdmin } from "@/lib/auth";
import { TaxRatesAdminView } from "@/components/admin/TaxRatesAdminView";

export default async function AdminTaxRatesPage() {
  await requirePlatformAdmin();
  return <TaxRatesAdminView />;
}
