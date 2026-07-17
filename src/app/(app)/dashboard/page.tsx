import { Suspense } from "react";
import { requireBusinessProfile } from "@/lib/auth";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const { profile } = await requireBusinessProfile();
  // Suspense because DashboardView reads ?upgrade= via useSearchParams, which
  // opts the tree into client-side rendering — same as the invoices page.
  return (
    <Suspense>
      <DashboardView businessName={profile.name ?? ""} />
    </Suspense>
  );
}
