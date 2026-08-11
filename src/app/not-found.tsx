import Link from "next/link";
import { Loggy } from "@/components/ui/Loggy";

// No not-found page existed, so an unmatched route fell back to Next's bare
// default. This gives it the app's sky background and a worried Loggy softening
// the news — the guide's placement for a generic 404. Loggy is decorative; the
// heading and link carry the message on their own.
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f0f9ff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "32px 24px",
      }}
    >
      <Loggy pose="worried" size={160} alt="" />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "18px 0 8px" }}>
        Eish, something went wrong
      </h1>
      <p style={{ fontSize: 14, color: "#0369A1", lineHeight: 1.6, margin: "0 0 24px", maxWidth: 320 }}>
        We couldn&apos;t find that page. It may have moved, or the link was off.
      </p>
      <Link
        href="/dashboard"
        style={{
          background: "#F59E0B",
          color: "#fff",
          borderRadius: 12,
          padding: "13px 24px",
          fontSize: 15,
          fontWeight: 700,
          textDecoration: "none",
          boxShadow: "0 4px 16px rgba(245,158,11,0.28)",
        }}
      >
        Back to dashboard
      </Link>
    </div>
  );
}
