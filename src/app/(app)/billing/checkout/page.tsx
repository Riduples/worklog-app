import { Suspense } from "react";
import { requireBusinessProfile } from "@/lib/auth";
import { CheckoutView } from "@/components/billing/CheckoutView";
import { payfastConfig } from "@/lib/payfast";

export default async function CheckoutPage() {
  // Deliberately NOT requirePlanAccess: this is the page you come to in order
  // to change your plan, so gating it by plan would lock the door from inside.
  await requireBusinessProfile();
  // Whether we can actually take a payment is a server-only fact (it depends on
  // secret credentials), so it's resolved here and handed down — the client
  // never sees the config, only whether the button is live.
  const { configured, mode } = payfastConfig();
  return (
    <Suspense>
      <CheckoutView payfastReady={configured} sandbox={mode === "sandbox"} />
    </Suspense>
  );
}
