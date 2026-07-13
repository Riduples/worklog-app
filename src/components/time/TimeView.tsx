"use client";

import { useState } from "react";
import Link from "next/link";
import { useTimeEntries, useUpdateTimeEntry, type TimeEntry } from "@/lib/supabase/hooks/useTimeEntries";
import { TimeModal } from "@/components/modals/TimeModal";
import { fmt } from "@/lib/format";

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  Billable: { bg: "#f0fdf4", fg: "#166534" },
  "Non-billable": { bg: "#f1f5f9", fg: "#64748b" },
  Admin: { bg: "#fff7ed", fg: "#b45309" },
  Travel: { bg: "#e0f2fe", fg: "#0369a1" },
};

export function TimeView() {
  const { data: entries, isLoading } = useTimeEntries();
  const updateEntry = useUpdateTimeEntry();
  const [showNew, setShowNew] = useState(false);

  const billableTotal = (entries ?? [])
    .filter((e) => e.bill_type === "Billable")
    .reduce((s, e) => s + Number(e.amount_to_bill || 0), 0);
  const totalHours = (entries ?? []).reduce((s, e) => s + Number(e.hours_worked || 0), 0);

  const handleSoftDelete = (id: string) => {
    if (!confirm("Remove this time entry?")) return;
    updateEntry.mutate({ id, changes: { deleted_at: new Date().toISOString() } });
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <Link href="/dashboard" style={{ fontSize: 12, color: "#64748b" }}>
            ← Dashboard
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1B4332", margin: "4px 0 0" }}>Time Tracker</h1>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ background: "#1B4332", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          + New
        </button>
      </div>

      {(entries ?? []).length > 0 && (
        <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#166534", display: "flex", justifyContent: "space-between" }}>
          <span>{totalHours.toFixed(1)}h logged</span>
          <span>
            Billable: <strong>{fmt(billableTotal)}</strong>
          </span>
        </div>
      )}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (entries ?? []).length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No time entries yet.</p>
      )}

      {(entries ?? []).map((e) => {
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
            <button
              onClick={() => handleSoftDelete(e.id)}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 4 }}
              aria-label="Remove time entry"
            >
              ✕
            </button>
          </div>
        );
      })}

      {showNew && <TimeModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
