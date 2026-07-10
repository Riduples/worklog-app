import { Suspense } from "react";
import { requireBusinessProfile } from "@/lib/auth";
import { InvoicesView } from "@/components/invoices/InvoicesView";

export default async function InvoicesPage() {
  await requireBusinessProfile();
  return (
    <Suspense>
      <InvoicesView />
    </Suspense>
  );
}
