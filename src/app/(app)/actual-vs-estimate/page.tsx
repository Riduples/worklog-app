import { requireBusinessProfile } from "@/lib/auth";
import { ActualVsEstimateView } from "@/components/time/ActualVsEstimateView";

export default async function ActualVsEstimatePage() {
  await requireBusinessProfile();
  return <ActualVsEstimateView />;
}
