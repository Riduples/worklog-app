"use client";

import { useState } from "react";
import { usePayRuns } from "@/lib/supabase/hooks/usePayRuns";
import { PayRunWizard } from "@/components/payroll/PayRunWizard";
import { PayRunDetailModal } from "@/components/modals/PayRunDetailModal";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { fmt } from "@/lib/format";
import { BackLink } from "@/components/ui/BackLink";
import type { Tables } from "@/lib/types/database";

type PayRun = Tables<"pay_runs">;

const STATUS_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  approved: { label: "Approved", bg: "#F0F9FF", fg: "#0369A1" },
  prepared: { label: "Prepared", bg: "#fff7ed", fg: "#b45309" },
};
const STATUS_ORDER = ["approved", "prepared"];

// Pay period is the other thing a pay run is filed under, and the payroll's own
// rhythm: weekly wages and monthly salaries are separate conversations with
// separate EMP201 lines. Pills follow the same rule as the type pills on Advances
// and Leave — only periods actually used, and only once there's more than one.
const PERIOD_ORDER = ["Weekly", "Fortnightly", "Monthly"];

// A–Z reads as a staff list, Recent as a payroll diary, and Amount surfaces the
// biggest payslips — the one a query about payroll cost usually starts from.
const SORTS = [
  { id: "az", label: "A–Z" },
  { id: "recent", label: "Recent" },
  { id: "amount", label: "Amount" },
] as const;

type Sort = (typeof SORTS)[number]["id"];

export function PayRunView() {
  const access = useToolAccess("payrun");
  const { data: payRuns, isLoading } = usePayRuns();

  const [view, setView] = useState<"list" | "new">("list");
  const [selected, setSelected] = useState<PayRun | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("az");

  // The wizard is the "+ New" flow — mounted fresh each time so its state always
  // starts clean, and its back arrow / Done return here.
  if (view === "new") return <PayRunWizard onExit={() => setView("list")} />;

  const all = payRuns ?? [];
  const presentStatuses = STATUS_ORDER.filter((s) => all.some((p) => p.status === s));
  const presentPeriods = [
    ...PERIOD_ORDER.filter((v) => all.some((p) => p.pay_period === v)),
    // Anything outside the three known periods still gets its own pill rather
    // than being unreachable behind the filter.
    ...[...new Set(all.map((p) => p.pay_period).filter(Boolean))].filter((v) => !PERIOD_ORDER.includes(v as string)),
  ] as string[];

  const filtered = all.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (periodFilter !== "all" && p.pay_period !== periodFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!`${p.worker_name} ${p.payslip_number ?? ""} ${p.pay_period ?? ""}`.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  // Date breaks the tie on both name and amount, so a person's runs always read
  // newest-first within their own group.
  const byDate = (a: PayRun, b: PayRun) => new Date(b.pay_date).getTime() - new Date(a.pay_date).getTime();
  const sorted = [...filtered].sort((a, b) =>
    sort === "az"
      ? a.worker_name.localeCompare(b.worker_name) || byDate(a, b)
      : sort === "amount"
        ? Number(b.net_pay || 0) - Number(a.net_pay || 0) || byDate(a, b)
        : byDate(a, b)
  );

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Pay Run</h1>
        </div>
        {access.canEdit && (
          <button
            onClick={() => setView("new")}
            style={{ background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + New
          </button>
        )}
      </div>

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="pay runs" />}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && all.length === 0 && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: 20, textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💵</div>
          <div style={{ fontSize: 14, color: "#64748b" }}>
            No pay runs yet.{access.canEdit ? " Tap “+ New” to pay someone." : ""}
          </div>
        </div>
      )}

      {!isLoading && all.length > 0 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pay runs..."
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, boxSizing: "border-box", marginBottom: 12, background: "#fff" }}
        />
      )}

      {presentStatuses.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {["all", ...presentStatuses].map((s) => {
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{ padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${active ? "#0C4A6E" : "#e2e8f0"}`, background: active ? "#0C4A6E" : "#fff", color: active ? "#fff" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}
              >
                {s === "all" ? "All" : STATUS_BADGE[s]?.label ?? s}
              </button>
            );
          })}
        </div>
      )}

      {/* Pay period sits under the status pills, the way the worker-type row sits
          under the status row on the Staff Register — so "prepared monthly runs"
          is two taps. */}
      {presentPeriods.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {["all", ...presentPeriods].map((v) => {
            const active = periodFilter === v;
            const count = v === "all" ? all.length : all.filter((p) => p.pay_period === v).length;
            return (
              <button
                key={v}
                onClick={() => setPeriodFilter(v)}
                style={{ padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${active ? "#0C4A6E" : "#e2e8f0"}`, background: active ? "#0C4A6E" : "#fff", color: active ? "#fff" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {v === "all" ? "All periods" : v}{" "}
                <span style={{ fontWeight: 600, color: active ? "#7DD3FC" : "#94a3b8" }}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {!isLoading && all.length > 0 && filtered.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No pay runs match your search.</p>
      )}

      {sorted.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "0 0 10px 2px" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {sorted.length}
            {sorted.length !== all.length ? ` of ${all.length}` : ""} pay run{all.length === 1 ? "" : "s"}
          </span>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
            {SORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: sort === s.id ? "#fff" : "transparent", color: sort === s.id ? "#0C4A6E" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: sort === s.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {sorted.map((p) => {
        const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.approved;
        return (
          <button
            key={p.id}
            onClick={() => setSelected(p)}
            style={{ width: "100%", background: "#fff", borderRadius: 13, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", border: "none", cursor: "pointer", textAlign: "left" }}
            aria-label="View pay run"
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{p.worker_name}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {p.pay_date} · {p.pay_period}
                {p.payslip_number ? ` · ${p.payslip_number}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: badge.bg, color: badge.fg }}>{badge.label}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#0C4A6E", whiteSpace: "nowrap" }}>{fmt(Number(p.net_pay || 0))}</span>
            </div>
          </button>
        );
      })}

      {selected && <PayRunDetailModal payRun={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
