import { requireBusinessProfile } from "@/lib/auth";
import { BankStatementView } from "@/components/money/BankStatementView";

export default async function BankStatementPage() {
  await requireBusinessProfile();
  return <BankStatementView />;
}
