"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { AdminNav } from "@/components/admin/AdminNav";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { useAdminBusinesses, type AdminBusiness } from "@/lib/supabase/hooks/useAdminData";

const DAY_MS = 86_400_000;

function statusBadge(status: string | null): { label: string; bg: string; color: string } {
  switch (status) {
    case "active": return { label: "Active", bg: "#DCFCE7", color: "#166534" };
    case "trialing": return { label: "Trial", bg: "#E0F2FE", color: "#0369A1" };
    case "past_due": return { label: "Past due", bg: "#FEF3C7", color: "#92400E" };
    case "read_only": return { label: "Read-only", bg: "#FEE2E2", color: "#991B1B" };
    case "cancelled": return { label: "Cancelled", bg: "#F1F5F9", color: "#475569" };
    default: return { label: "No subscription", bg: "#F1F5F9", color: "#64748b" };
  }
}

function periodNote(b: AdminBusiness): string {
  if (!b.current_period_end) return "";
  const end = new Date(b.current_period_end).getTime();
  const days = Math.ceil((end - Date.now()) / DAY_MS);
  const when = b.current_period_end.slice(0, 10);
  if (b.sub_status === "trialing") return days >= 0 ? `${days} day${days === 1 ? "" : "s"} left · ends ${when}` : `expired ${when}`;
  if (b.sub_status === "active") return `renews ${when}`;
  return `until ${when}`;
}

export function BusinessesAdminView() {
  const { data: businesses } = useAdminBusinesses();
  const [q, setQ] = useState("");
  const [managing, setManaging] = useState<AdminBusiness | null>(null);

  const term = q.trim().toLowerCase();
  const list = (businesses ?? []).filter(
    (b) => !term || b.name.toLowerCase().includes(term) || (b.owner_email ?? "").toLowerCase().includes(term)
  );

  return (
    <div style={{ padding: "20px 16px 100px", maxWidth: 900, margin: "0 auto" }}>
      <AdminNav active="businesses" />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", marginBottom: 10 }}>
        Businesses <span style={{ fontSize: 14, color: "#94a3b8", fontWeight: 600 }}>({businesses?.length ?? 0})</span>
      </h1>
      <div style={{ marginBottom: 14 }}>
        <Input value={q} onChange={setQ} placeholder="Search by business name or owner email" />
      </div>

      {list.map((b) => {
        const badge = statusBadge(b.sub_status);
        return (
          <div key={b.business_id} style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "13px 16px", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#0C4A6E" }}>{b.name}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, background: badge.bg, color: badge.color, borderRadius: 8, padding: "2px 8px" }}>{badge.label}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{b.plan}{b.sub_tier && b.sub_tier !== b.plan ? ` (sub: ${b.sub_tier})` : ""}</span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  {b.owner_email ?? "no owner email"} · {b.member_count} member{b.member_count === 1 ? "" : "s"} · joined {b.created_at.slice(0, 10)}
                </div>
                {periodNote(b) && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{periodNote(b)}</div>}
              </div>
              <button
                onClick={() => setManaging(b)}
                style={{ flexShrink: 0, background: "#f0f9ff", border: "1.5px solid #bfdbfe", borderRadius: 9, padding: "7px 13px", fontSize: 12, fontWeight: 700, color: "#1e40af", cursor: "pointer" }}
              >
                Manage
              </button>
            </div>
          </div>
        );
      })}
      {list.length === 0 && <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", marginTop: 24 }}>No businesses match.</p>}

      {managing && <ManageModal business={managing} onClose={() => setManaging(null)} />}
    </div>
  );
}

function ManageModal({ business, onClose }: { business: AdminBusiness; onClose: () => void }) {
  const supabase = createClient();
  const qc = useQueryClient();
  const [days, setDays] = useState("14");
  const [tier, setTier] = useState(business.sub_tier ?? "structured");
  const [status, setStatus] = useState(
    business.sub_status && ["active", "trialing", "read_only", "cancelled"].includes(business.sub_status)
      ? business.sub_status
      : "active"
  );
  // A trial can only be extended from a trialing/read-only state — extending a
  // paying account would silently downgrade it (server enforces this too).
  const canExtend = business.sub_status === "trialing" || business.sub_status === "read_only";
  const [periodEnd, setPeriodEnd] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-businesses"] });

  const extend = async () => {
    setError(""); setDone(""); setBusy(true);
    const { error } = await supabase.rpc("admin_extend_trial", { p_business_id: business.business_id, p_days: Number(days) });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setDone(`Trial extended by ${days} days.`);
    refresh();
  };

  const applyPlan = async () => {
    setError(""); setDone(""); setBusy(true);
    const { error } = await supabase.rpc("admin_set_plan", {
      p_business_id: business.business_id,
      p_tier: tier,
      p_status: status,
      p_period_end: periodEnd,
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setDone(`Set to ${tier} / ${status}.`);
    refresh();
  };

  return (
    <Modal title={business.name} onClose={onClose}>
      <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14, lineHeight: 1.5 }}>
        {business.owner_email ?? "no owner email"} — currently <strong>{statusBadge(business.sub_status).label}</strong>. These
        act on this business only; changes take effect on their next page load.
      </p>

      {canExtend && (
        <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0369A1", marginBottom: 8 }}>Extend trial</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 90 }}><Input value={days} onChange={setDays} type="number" /></div>
            <span style={{ fontSize: 12, color: "#64748b" }}>days</span>
            <button onClick={extend} disabled={busy} style={{ marginLeft: "auto", background: "#0369A1", color: "#fff", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              Extend
            </button>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0C4A6E", marginBottom: 8 }}>Set plan / status (comp, fix, or cancel)</div>
        <Field label="Tier">
          <Chips options={["solo", "trade", "structured"]} selected={tier} onSelect={(v) => v && setTier(v)} />
        </Field>
        <Field label="Status">
          <Chips options={["active", "trialing", "read_only", "cancelled"]} selected={status} onSelect={(v) => v && setStatus(v)} />
        </Field>
        <Field label="Period / trial end date">
          <Input value={periodEnd} onChange={setPeriodEnd} type="date" />
        </Field>
        <button onClick={applyPlan} disabled={busy} style={{ width: "100%", background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 11, padding: 12, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {busy ? "Applying..." : "Apply"}
        </button>
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}
      {done && <p style={{ color: "#166534", fontSize: 13, fontWeight: 700 }}>✅ {done}</p>}
    </Modal>
  );
}
