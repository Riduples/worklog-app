import Link from "next/link";

// PayFast's cancel_url — reached when the buyer backs out on PayFast's side.
// Nothing was charged, so this is reassurance, not an error.
export default function BillingCancelPage() {
  return (
    <div style={{ padding: "40px 20px", maxWidth: 460, margin: "0 auto", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>👍</div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", marginBottom: 8 }}>No payment made</h1>
      <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 24 }}>
        You cancelled before paying, so nothing was charged. You can pick a plan whenever you&apos;re ready — Worklog
        keeps working on your current plan in the meantime.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/billing/checkout" style={{ ...btn, background: "#0C4A6E", color: "#fff" }}>
          See the plans
        </Link>
        <Link href="/dashboard" style={{ ...btn, background: "#fff", color: "#0C4A6E", border: "1.5px solid #BAE6FD" }}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  display: "inline-block",
  borderRadius: 14,
  padding: "13px 22px",
  fontWeight: 700,
  fontSize: 14,
  textDecoration: "none",
};
