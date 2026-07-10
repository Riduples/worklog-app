import { requireBusinessProfile } from "@/lib/auth";
import { PurchaseOrdersView } from "@/components/purchase-orders/PurchaseOrdersView";

export default async function PurchaseOrdersPage() {
  await requireBusinessProfile();
  return <PurchaseOrdersView />;
}
