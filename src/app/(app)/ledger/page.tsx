import { requireBusinessProfile } from "@/lib/auth";
import { LedgerView } from "@/components/ledger/LedgerView";

export default async function LedgerPage() {
  await requireBusinessProfile();
  return <LedgerView />;
}
