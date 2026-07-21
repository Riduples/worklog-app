"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { TIERS, type Plan } from "@/lib/tiers";

// Where PayFast sends the buyer back after paying. The payment itself is
// confirmed out of band — PayFast posts the ITN to the server, which moves the
// plan — so this page waits for that to land rather than claiming success on
// its own. It polls the business's plan for a few seconds; the moment it turns
// paid, the upgrade went through.
export default function BillingReturnPage() {
  const { data: business, refetch } = useBusinessProfile();
  const plan = (business?.plan ?? "solo") as Plan;
  const activated = plan === "trade" || plan === "structured";
  const [ticks, setTicks] = useState(0);
  const stillWaiting = !activated && ticks < 8; // ~16s before we stop spinning

  useEffect(() => {
    if (!stillWaiting) return;
    const id = setInterval(() => {
      void refetch();
      setTicks((t) => t + 1);
    }, 2000);
    return () => clearInterval(id);
  }, [stillWaiting, refetch]);

  return (
    <div style={{ padding: "40px 20px", maxWidth: 460, margin: "0 auto", textAlign: "center" }}>
      {activated ? (
        <>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0C4A6E", marginBottom: 8 }}>
            You&apos;re on {TIERS[plan].label}
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 24 }}>
            Your payment is confirmed and everything in {TIERS[plan].label} is unlocked. Thank you for backing Worklog.
          </p>
          <Link href="/dashboard" style={btn}>
            Go to my dashboard
          </Link>
        </>
      ) : stillWaiting ? (
        <>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", marginBottom: 8 }}>Payment received</h1>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
            Activating your plan… this usually takes a few seconds.
          </p>
        </>
      ) : (
        <>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", marginBottom: 8 }}>Payment received</h1>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 24 }}>
            Your plan will activate as soon as PayFast confirms the payment — usually within a minute. Your dashboard
            will show the new plan once it&apos;s through.
          </p>
          <Link href="/dashboard" style={btn}>
            Back to my dashboard
          </Link>
        </>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  display: "inline-block",
  background: "#0C4A6E",
  color: "#fff",
  borderRadius: 14,
  padding: "13px 24px",
  fontWeight: 700,
  fontSize: 14,
  textDecoration: "none",
};
