import { Suspense } from "react";
import { requireBusinessProfile } from "@/lib/auth";
import { CheckoutView } from "@/components/billing/CheckoutView";

export default async function CheckoutPage() {
  // Deliberately NOT requirePlanAccess: this is the page you come to in order
  // to change your plan, so gating it by plan would lock the door from inside.
  await requireBusinessProfile();
  return (
    <Suspense>
      <CheckoutView />
    </Suspense>
  );
}
