import { requirePlatformAdmin } from "@/lib/auth";
import { AnnouncementsAdminView } from "@/components/admin/AnnouncementsAdminView";

export default async function AdminAnnouncementsPage() {
  await requirePlatformAdmin();
  return <AnnouncementsAdminView />;
}
