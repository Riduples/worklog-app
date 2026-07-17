import { requirePlanAccess } from "@/lib/auth";
import { SupplierInvoicesView } from "@/components/supplier-invoices/SupplierInvoicesView";

export default async function SupplierInvoicesPage() {
  await requirePlanAccess("supplierinvoice");
  return <SupplierInvoicesView />;
}
