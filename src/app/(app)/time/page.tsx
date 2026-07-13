import { requireBusinessProfile } from "@/lib/auth";
import { TimeView } from "@/components/time/TimeView";

export default async function TimePage() {
  await requireBusinessProfile();
  return <TimeView />;
}
