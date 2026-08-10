import { requireBusinessProfile } from "@/lib/auth";
import { TimeTravelReportsView } from "@/components/reports/TimeTravelReportsView";

export default async function TimeTravelReportsPage() {
  await requireBusinessProfile();
  return <TimeTravelReportsView />;
}
