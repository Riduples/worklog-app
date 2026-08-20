import { requireBusinessProfile } from "@/lib/auth";
import { BankingView } from "@/components/money/BankingView";

export default async function BankingPage() {
  await requireBusinessProfile();
  return <BankingView />;
}
