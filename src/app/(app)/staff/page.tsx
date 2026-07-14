import { requireBusinessProfile } from "@/lib/auth";
import { StaffView } from "@/components/staff/StaffView";

export default async function StaffPage() {
  await requireBusinessProfile();
  return <StaffView />;
}
