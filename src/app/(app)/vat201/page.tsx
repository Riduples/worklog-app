import { requireBusinessProfile } from "@/lib/auth";
import { Vat201View } from "@/components/reports/Vat201View";

export default async function Vat201Page() {
  await requireBusinessProfile();
  return <Vat201View />;
}
