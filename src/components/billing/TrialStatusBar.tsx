"use client";

import Link from "next/link";
import { useTrialState } from "@/lib/supabase/hooks/useSubscription";

/**
 * The trial countdown pill and the read-only notice, driven by the business's
 * subscription. Unobtrusive on an active trial; reassuring (never punitive) once
 * it has lapsed. The server is what actually blocks writes (business_is_writable
 * in the RLS chokepoint) — this only tells the user why.
 */
export function TrialStatusBar() {
  const { isTrialing, trialDaysLeft, isReadOnly } = useTrialState();

  if (isReadOnly) {
    return (
      <div style={{ margin: "12px 16px 0", background: "#FFFBEB", border: "1.5px solid #E8A33D", borderRadius: 14, padding: "14px 16px" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0C4A6E", marginBottom: 4 }}>Your free trial has ended</div>
        <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.6, marginBottom: 12 }}>
          Your records are safe — you can still view and download everything. Choose a plan to start adding and editing again.
        </div>
        <Link
          href="/billing/checkout"
          style={{
            display: "inline-block", background: "#E8A33D", color: "#fff", fontSize: 13, fontWeight: 700,
            padding: "9px 16px", borderRadius: 10, textDecoration: "none",
          }}
        >
          Choose a plan →
        </Link>
      </div>
    );
  }

  if (isTrialing && trialDaysLeft != null) {
    return (
      <Link
        href="/billing/checkout"
        style={{
          display: "flex", alignItems: "center", gap: 8, margin: "12px 16px 0", padding: "10px 14px",
          background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, textDecoration: "none",
        }}
      >
        <span style={{ fontSize: 15 }}>🎁</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0369A1" }}>
          Free trial · {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left
        </span>
        <span style={{ fontSize: 11.5, color: "#64748b", marginLeft: "auto" }}>Everything unlocked — see plans →</span>
      </Link>
    );
  }

  return null;
}
