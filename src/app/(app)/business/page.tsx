import { redirect } from "next/navigation";
import { requireBusinessProfile } from "@/lib/auth";
import { BusinessHub } from "@/components/business/BusinessHub";

export default async function BusinessPage() {
  const { user, profile } = await requireBusinessProfile();
  // Owner-only: the hub gathers business details, bank accounts and team — all
  // owner concerns. business_profiles.user_id is the owner; a member's own id
  // won't match, so they're sent back to their dashboard.
  if (profile.user_id !== user.id) redirect("/dashboard");
  return <BusinessHub />;
}
