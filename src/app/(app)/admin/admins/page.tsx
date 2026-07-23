import { requirePlatformAdmin } from "@/lib/auth";
import { AdminsAdminView } from "@/components/admin/AdminsAdminView";

export default async function AdminAdminsPage() {
  const user = await requirePlatformAdmin();
  return <AdminsAdminView currentUserId={user.id} />;
}
