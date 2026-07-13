import { requireBusinessProfile } from "@/lib/auth";
import { MileageView } from "@/components/mileage/MileageView";

export default async function MileagePage() {
  await requireBusinessProfile();
  return <MileageView />;
}
