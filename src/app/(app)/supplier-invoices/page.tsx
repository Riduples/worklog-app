import { requireBusinessProfile } from "@/lib/auth";
import { SupplierInvoicesView } from "@/components/supplier-invoices/SupplierInvoicesView";

export default async function SupplierInvoicesPage() {
  await requireBusinessProfile();
  return <SupplierInvoicesView />;
}
