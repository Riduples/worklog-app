"use client";

import { useState } from "react";
import { useLedgerEntries, useUpdateLedgerEntry, type LedgerEntry } from "@/lib/supabase/hooks/useLedger";
import { LedgerModal } from "@/components/modals/LedgerModal";
import { fmt, todayStr } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { BackLink } from "@/components/ui/BackLink";

export function LedgerView() {
  const access = useToolAccess("ledger");
  const { data: entries, isLoading } = useLedgerEntries();
  const updateEntry = useUpdateLedgerEntry();
  const [showNew, setShowNew] = useState(false);

  const unpaid = (entries ?? []).filter((e) => e.status !== "paid");
  const clientOwed = unpaid.filter((e) => e.ledger_type === "client").reduce((s, e) => s + Number(e.amount), 0);
  const supplierOwed = unpaid.filter((e) => e.ledger_type === "supplier").reduce((s, e) => s + Number(e.amount), 0);

  const markPaid = (e: LedgerEntry) =>
    updateEntry.mutate({ id: e.id, changes: { status: "paid", paid_date: todayStr() } });
  const handleSoftDelete = (id: string) => {
    if (!confirm("Remove this ledger entry?")) return;
    updateEntry.mutate({ id, changes: { deleted_at: new Date().toISOString() } });
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Ledgers</h1>
        </div>
        {access.canEdit && (
          <button
            onClick={() => setShowNew(true)}
            style={{ background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + New
          </button>
        )}
      </div>

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="ledger entries" />}

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, background: "#F0F9FF", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, color: "#0369A1", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Owed to you</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0C4A6E" }}>{fmt(clientOwed)}</div>
        </div>
        <div style={{ flex: 1, background: "#fff7ed", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, color: "#92400e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>You owe</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#b45309" }}>{fmt(supplierOwed)}</div>
        </div>
      </div>

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (entries ?? []).length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No ledger entries yet.</p>
      )}

      {(entries ?? []).map((e) => (
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
            opacity: e.status === "paid" ? 0.6 : 1,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{e.party_name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {e.ledger_type === "client" ? "Owes you" : "You owe"} · {e.entry_date}
              {e.note ? ` · ${e.note}` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right", marginRight: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: e.ledger_type === "client" ? "#0C4A6E" : "#b45309" }}>{fmt(e.amount)}</div>
            {e.status === "paid" ? (
              <span style={{ fontSize: 10, color: "#0369A1", fontWeight: 700 }}>✓ Settled</span>
            ) : (
              <button onClick={() => markPaid(e)} style={{ fontSize: 10, color: "#0369a1", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Mark settled
              </button>
            )}
          </div>
          {access.canDelete && (
            <button
              onClick={() => handleSoftDelete(e.id)}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 4 }}
              aria-label="Remove ledger entry"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      {showNew && <LedgerModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
