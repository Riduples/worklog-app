import { requireBusinessProfile } from "@/lib/auth";
import { Emp201View } from "@/components/reports/Emp201View";

export default async function Emp201Page() {
  await requireBusinessProfile();
  return <Emp201View />;
}
