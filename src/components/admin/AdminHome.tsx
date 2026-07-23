"use client";

import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { useAdminBusinesses } from "@/lib/supabase/hooks/useAdminData";

const CARDS: { href: string; icon: string; title: string; desc: string }[] = [
  { href: "/admin/businesses", icon: "🏢", title: "Businesses", desc: "Every account: owner, plan, subscription state — with support controls." },
  { href: "/admin/revenue", icon: "📈", title: "Revenue & subscriptions", desc: "MRR, active/trial/past-due counts, and trials expiring soon." },
  { href: "/admin/payments", icon: "💳", title: "Payment events", desc: "The PayFast ITN audit trail — debug activation issues." },
  { href: "/admin/announcements", icon: "📣", title: "Announcements", desc: "Post a banner shown to every user across the app." },
  { href: "/admin/tax-rates", icon: "🧾", title: "SARS rates", desc: "National tax figures used across every business." },
];

export function AdminHome() {
  const { data: businesses } = useAdminBusinesses();
  const total = businesses?.length ?? 0;
  const active = (businesses ?? []).filter((b) => b.sub_status === "active").length;
  const trialing = (businesses ?? []).filter((b) => b.sub_status === "trialing").length;

  return (
    <div style={{ padding: "20px 16px 100px", maxWidth: 820, margin: "0 auto" }}>
      <AdminNav active="home" />

      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0C4A6E", marginBottom: 4 }}>Admin console</h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 18 }}>Platform-wide tools. Only visible to platform admins.</p>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <Stat label="Businesses" value={String(total)} />
        <Stat label="Active subscriptions" value={String(active)} />
        <Stat label="On trial" value={String(trialing)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "16px", textDecoration: "none", display: "block" }}
          >
            <div style={{ fontSize: 26, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0C4A6E", marginBottom: 3 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: "1 1 150px", background: "#0C4A6E", borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, color: "#7DD3FC", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginTop: 2 }}>{value}</div>
    </div>
  );
}
