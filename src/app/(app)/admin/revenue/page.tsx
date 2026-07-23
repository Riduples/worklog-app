import { requirePlatformAdmin } from "@/lib/auth";
import { RevenueAdminView } from "@/components/admin/RevenueAdminView";

export default async function AdminRevenuePage() {
  await requirePlatformAdmin();
  return <RevenueAdminView />;
}
