"use client";

import { AdminNav } from "@/components/admin/AdminNav";
import { useAdminBusinesses } from "@/lib/supabase/hooks/useAdminData";

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function GrowthAdminView() {
  const { data: businesses } = useAdminBusinesses();
  const list = businesses ?? [];
  const total = list.length;

  const active = list.filter((b) => b.sub_status === "active").length;
  const trialing = list.filter((b) => b.sub_status === "trialing").length;
  const lapsed = list.filter((b) => b.sub_status === "read_only" || b.sub_status === "cancelled").length;
  const noSub = list.filter((b) => !b.sub_status).length;
  const payingRate = total > 0 ? Math.round((active / total) * 100) : 0;

  // Signups per month, last 8 months (including zero months).
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: d.toLocaleString("en-ZA", { month: "short" }) });
  }
  const counts = new Map<string, number>();
  for (const b of list) counts.set(monthKey(new Date(b.created_at)), (counts.get(monthKey(new Date(b.created_at))) ?? 0) + 1);
  const series = months.map((m) => ({ ...m, n: counts.get(m.key) ?? 0 }));
  const maxN = Math.max(1, ...series.map((s) => s.n));

  const thisMonth = counts.get(monthKey(now)) ?? 0;
  const lastMonth = counts.get(monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))) ?? 0;

  return (
    <div style={{ padding: "20px 16px 100px", maxWidth: 820, margin: "0 auto" }}>
      <AdminNav active="growth" />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", marginBottom: 14 }}>Growth</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <Stat label="Total businesses" value={String(total)} />
        <Stat label="Paying" value={String(active)} />
        <Stat label="Paying rate" value={`${payingRate}%`} />
        <Stat label="New this month" value={String(thisMonth)} sub={`${lastMonth} last month`} />
      </div>

      <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "16px" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 14 }}>
          Signups per month
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140 }}>
          {series.map((s) => (
            <div key={s.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#0C4A6E" }}>{s.n}</span>
              <div
                title={`${s.n} in ${s.label}`}
                style={{ width: "100%", maxWidth: 40, height: `${(s.n / maxN) * 100}%`, minHeight: s.n > 0 ? 4 : 0, background: "#0C4A6E", borderRadius: "5px 5px 0 0" }}
              />
              <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 14, lineHeight: 1.6 }}>
        On trial {trialing} · lapsed (read-only or cancelled) {lapsed} · no subscription {noSub}. Figures are from current
        subscription state — paying rate is active subscriptions ÷ total businesses.
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ flex: "1 1 150px", background: "#0C4A6E", borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, color: "#7DD3FC", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#BAE6FD", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
