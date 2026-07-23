import { requirePlatformAdmin } from "@/lib/auth";
import { AdminHome } from "@/components/admin/AdminHome";

export default async function AdminHomePage() {
  await requirePlatformAdmin();
  return <AdminHome />;
}
