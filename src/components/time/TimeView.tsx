"use client";

import { useState } from "react";
import { useTimeEntries, useUpdateTimeEntry, type TimeEntry } from "@/lib/supabase/hooks/useTimeEntries";
import { useQuotes } from "@/lib/supabase/hooks/useQuotes";
import { TimeModal } from "@/components/modals/TimeModal";
import { JobProfitabilityView } from "@/components/time/JobProfitabilityView";
import { fmt } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { BackLink } from "@/components/ui/BackLink";

// The Time modal only ever records Billable or Non-billable (see TimeModal's
// BILL_TYPES), so those are the only two types the list needs to colour or
// filter by. Anything unexpected falls back to the Billable colour below.
const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  Billable: { bg: "#F0F9FF", fg: "#0369A1" },
  "Non-billable": { bg: "#f1f5f9", fg: "#64748b" },
};

// Type filter pills follow this order; only types actually in use get a pill,
// matching how Contacts, Sales, Purchases and the rest of the list tools behave.
const TYPE_ORDER = ["Billable", "Non-billable"];

export function TimeView() {
  const access = useToolAccess("timetrack");
  const { data: entries, isLoading } = useTimeEntries();
  const { data: quotes } = useQuotes();
  const updateEntry = useUpdateTimeEntry();
  const [modalState, setModalState] = useState<{ open: boolean; entry?: TimeEntry }>({ open: false });
  const [view, setView] = useState<"log" | "profitability">("log");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sort, setSort] = useState<"az" | "recent">("recent");

  const all = entries ?? [];
  const billableTotal = all
    .filter((e) => e.bill_type === "Billable")
    .reduce((s, e) => s + Number(e.amount_to_bill || 0), 0);
  const totalHours = all.reduce((s, e) => s + Number(e.hours_worked || 0), 0);

  // Only the bill types actually in use get a filter pill.
  const presentTypes = TYPE_ORDER.filter((t) => all.some((e) => e.bill_type === t));

  // Search on client and description, filter by type, then order the same two
  // ways the other list tools offer: A–Z by client, or most recent date first.
  const filtered = all
    .filter((e) => {
      if (typeFilter !== "all" && e.bill_type !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!`${e.client_name ?? ""} ${e.description ?? ""}`.toLowerCase().includes(s)) return false;
      }
      return true;
    })
    .sort((a, b) =>
      sort === "az"
        ? (a.client_name || a.description || "").localeCompare(b.client_name || b.description || "")
        : (b.entry_date ?? "").localeCompare(a.entry_date ?? "")
    );

  const handleSoftDelete = (id: string) => {
    if (!confirm("Remove this time entry?")) return;
    updateEntry.mutate({ id, changes: { deleted_at: new Date().toISOString() } });
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Time Tracker</h1>
        </div>
        {access.canEdit && (
          <button
            onClick={() => setModalState({ open: true })}
            style={{ background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + New
          </button>
        )}
      </div>

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="time entries" />}

      {all.length > 0 && (
        <div style={{ background: "#F0F9FF", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#0369A1", display: "flex", justifyContent: "space-between" }}>
          <span>{totalHours.toFixed(1)}h logged</span>
          <span>
            Billable: <strong>{fmt(billableTotal)}</strong>
          </span>
        </div>
      )}

      {all.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["log", "profitability"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "8px 14px",
                borderRadius: 20,
                border: `1.5px solid ${view === v ? "#0C4A6E" : "#e2e8f0"}`,
                background: view === v ? "#0C4A6E" : "#fff",
                color: view === v ? "#fff" : "#374151",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {v === "log" ? "Time log" : "📊 Actual vs Estimate"}
            </button>
          ))}
        </div>
      )}

      {view === "profitability" ? (
        <JobProfitabilityView entries={entries ?? []} quotes={quotes ?? []} />
      ) : (
        <>
      {!isLoading && all.length > 0 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search time entries..."
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, boxSizing: "border-box", marginBottom: 12, background: "#fff" }}
        />
      )}

      {presentTypes.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {["all", ...presentTypes].map((t) => {
            const active = typeFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                style={{ padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${active ? "#0C4A6E" : "#e2e8f0"}`, background: active ? "#0C4A6E" : "#fff", color: active ? "#fff" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {t === "all" ? "All" : t}
              </button>
            );
          })}
        </div>
      )}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && all.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No time entries yet.</p>
      )}
      {!isLoading && all.length > 0 && filtered.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No time entries match your search.</p>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "0 0 10px 2px" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {filtered.length}
            {filtered.length !== all.length ? ` of ${all.length}` : ""} entr{all.length === 1 ? "y" : "ies"}
          </span>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
            {(["az", "recent"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: sort === s ? "#fff" : "transparent", color: sort === s ? "#0C4A6E" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: sort === s ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
              >
                {s === "az" ? "A–Z" : "Recent"}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.map((e) => {
        const color = TYPE_COLORS[e.bill_type] ?? TYPE_COLORS.Billable;
        return (
          <div
            key={e.id}
            style={{
              background: "#fff",
              borderRadius: 13,
              padding: "12px 14px",
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
                {e.client_name || e.description || "Time entry"}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {e.entry_date} · {Number(e.hours_worked).toFixed(1)}h
                {e.bill_type === "Billable" && Number(e.amount_to_bill) > 0 ? ` · ${fmt(e.amount_to_bill)}` : ""}
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: color.bg, color: color.fg, marginRight: 8 }}>
              {e.bill_type}
            </span>
            {access.canEdit && (
              <button
                onClick={() => setModalState({ open: true, entry: e })}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 4 }}
                aria-label="Edit time entry"
              >
                ✏️
              </button>
            )}
            {access.canDelete && (
              <button
                onClick={() => handleSoftDelete(e.id)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 4 }}
                aria-label="Remove time entry"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
        </>
      )}

      {modalState.open && (
        <TimeModal
          entry={modalState.entry}
          onClose={() => setModalState({ open: false })}
          onShowProfitability={() => {
            setModalState({ open: false });
            setView("profitability");
          }}
        />
      )}
    </div>
  );
}
