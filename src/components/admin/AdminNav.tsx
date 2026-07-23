"use client";

import Link from "next/link";

const TOOLS: { key: string; label: string; href: string }[] = [
  { key: "home", label: "Overview", href: "/admin" },
  { key: "businesses", label: "Businesses", href: "/admin/businesses" },
  { key: "revenue", label: "Revenue", href: "/admin/revenue" },
  { key: "growth", label: "Growth", href: "/admin/growth" },
  { key: "payments", label: "Payments", href: "/admin/payments" },
  { key: "announcements", label: "Announcements", href: "/admin/announcements" },
  { key: "tax-rates", label: "Tax rates", href: "/admin/tax-rates" },
  { key: "admins", label: "Admins", href: "/admin/admins" },
];

/** Shared header + tool nav for every /admin page. */
export function AdminNav({ active }: { active: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
          ⚙ Admin console
        </span>
        <Link href="/dashboard" style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textDecoration: "none" }}>
          ← Back to app
        </Link>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {TOOLS.map((t) => {
          const on = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href}
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                padding: "7px 13px",
                borderRadius: 999,
                textDecoration: "none",
                background: on ? "#0C4A6E" : "#fff",
                color: on ? "#fff" : "#0C4A6E",
                border: `1.5px solid ${on ? "#0C4A6E" : "#e2e8f0"}`,
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
