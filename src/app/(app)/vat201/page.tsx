import { requirePlanAccess } from "@/lib/auth";
import { Vat201View } from "@/components/reports/Vat201View";

export default async function Vat201Page() {
  await requirePlanAccess("vat201");
  return <Vat201View />;
}
