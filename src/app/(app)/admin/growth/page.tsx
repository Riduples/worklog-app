import { requirePlatformAdmin } from "@/lib/auth";
import { GrowthAdminView } from "@/components/admin/GrowthAdminView";

export default async function AdminGrowthPage() {
  await requirePlatformAdmin();
  return <GrowthAdminView />;
}
