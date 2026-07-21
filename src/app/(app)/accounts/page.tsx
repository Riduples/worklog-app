import { requireBusinessProfile } from "@/lib/auth";
import { AccountsView } from "@/components/accounts/AccountsView";

export default async function AccountsPage() {
  await requireBusinessProfile();
  return <AccountsView />;
}
