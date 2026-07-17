import { requirePlanAccess } from "@/lib/auth";
import { PurchaseOrdersView } from "@/components/purchase-orders/PurchaseOrdersView";

export default async function PurchaseOrdersPage() {
  await requirePlanAccess("purchaseorder");
  return <PurchaseOrdersView />;
}
