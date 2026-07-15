import { requireBusinessProfile } from "@/lib/auth";
import { CashUpView } from "@/components/money/CashUpView";

export default async function CashUpPage() {
  await requireBusinessProfile();
  return <CashUpView />;
}
