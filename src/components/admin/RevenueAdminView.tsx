"use client";

import { AdminNav } from "@/components/admin/AdminNav";
import { useAdminBusinesses, type AdminBusiness } from "@/lib/supabase/hooks/useAdminData";
import { PLAN_PRICE_ZAR, type Plan } from "@/lib/tiers";
import { fmt } from "@/lib/format";

const DAY_MS = 86_400_000;
const isPlan = (v: string | null): v is Plan => v === "solo" || v === "trade" || v === "structured";

export function RevenueAdminView() {
  const { data: businesses } = useAdminBusinesses();
  const list = businesses ?? [];

  const byStatus = (s: string | null) => list.filter((b) => b.sub_status === s);
  const active = byStatus("active");
  const trialing = byStatus("trialing");
  const pastDue = byStatus("past_due");
  const readOnly = byStatus("read_only");
  const cancelled = byStatus("cancelled");
  const noSub = list.filter((b) => !b.sub_status);

  // MRR = sum of each active subscription's plan price (VAT-inclusive ZAR).
  const mrr = active.reduce((sum, b) => sum + (isPlan(b.sub_tier) ? PLAN_PRICE_ZAR[b.sub_tier] : 0), 0);

  const now = Date.now();
  const expiringSoon = trialing
    .filter((b) => b.current_period_end && new Date(b.current_period_end).getTime() - now <= 7 * DAY_MS && new Date(b.current_period_end).getTime() >= now)
    .sort((a, b) => new Date(a.current_period_end!).getTime() - new Date(b.current_period_end!).getTime());

  const daysLeft = (b: AdminBusiness) => Math.ceil((new Date(b.current_period_end!).getTime() - now) / DAY_MS);

  return (
    <div style={{ padding: "20px 16px 100px", maxWidth: 820, margin: "0 auto" }}>
      <AdminNav active="revenue" />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", marginBottom: 14 }}>Revenue &amp; subscriptions</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Stat label="Est. MRR" value={fmt(mrr)} big />
        <Stat label="Active" value={String(active.length)} />
        <Stat label="On trial" value={String(trialing.length)} />
        <Stat label="Past due" value={String(pastDue.length)} amber={pastDue.length > 0} />
      </div>

      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 20, lineHeight: 1.5 }}>
        MRR is the sum of each active subscription&apos;s plan price (VAT-inclusive). Read-only {readOnly.length} · cancelled{" "}
        {cancelled.length} · no subscription {noSub.length}.
      </div>

      <Section title={`Trials expiring in 7 days (${expiringSoon.length})`}>
        {expiringSoon.length === 0 ? (
          <Empty>No trials ending this week.</Empty>
        ) : (
          expiringSoon.map((b) => (
            <Row key={b.business_id} name={b.name} email={b.owner_email} right={`${daysLeft(b)} day${daysLeft(b) === 1 ? "" : "s"} left`} rightColor="#0369A1" />
          ))
        )}
      </Section>

      <Section title={`Past due — in dunning (${pastDue.length})`}>
        {pastDue.length === 0 ? (
          <Empty>Nobody is past due. 🎉</Empty>
        ) : (
          pastDue.map((b) => (
            <Row key={b.business_id} name={b.name} email={b.owner_email} right={b.sub_tier ?? ""} rightColor="#92400E" />
          ))
        )}
      </Section>
    </div>
  );
}

function Stat({ label, value, big, amber }: { label: string; value: string; big?: boolean; amber?: boolean }) {
  return (
    <div style={{ flex: big ? "1 1 200px" : "1 1 110px", background: amber ? "#FEF3C7" : "#0C4A6E", borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, color: amber ? "#92400E" : "#7DD3FC", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: big ? 30 : 24, fontWeight: 800, color: amber ? "#92400E" : "#fff", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>{title}</div>
      <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function Row({ name, email, right, rightColor }: { name: string; email: string | null; right: string; rightColor: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderTop: "1px solid #f3f5f8", gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{name}</div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>{email ?? ""}</div>
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: rightColor, flexShrink: 0 }}>{right}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "14px", fontSize: 12.5, color: "#94a3b8", textAlign: "center" }}>{children}</div>;
}
