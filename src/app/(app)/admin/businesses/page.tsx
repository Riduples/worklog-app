import { requirePlatformAdmin } from "@/lib/auth";
import { BusinessesAdminView } from "@/components/admin/BusinessesAdminView";

export default async function AdminBusinessesPage() {
  await requirePlatformAdmin();
  return <BusinessesAdminView />;
}
