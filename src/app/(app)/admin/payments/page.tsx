import { requirePlatformAdmin } from "@/lib/auth";
import { PaymentEventsAdminView } from "@/components/admin/PaymentEventsAdminView";

export default async function AdminPaymentsPage() {
  await requirePlatformAdmin();
  return <PaymentEventsAdminView />;
}
