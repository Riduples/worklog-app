import { requireBusinessProfile } from "@/lib/auth";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const { profile } = await requireBusinessProfile();
  return <DashboardView businessName={profile.name ?? ""} />;
}
