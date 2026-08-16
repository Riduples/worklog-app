"use client";

import { useState } from "react";
import { usePurchaseOrders, useUpdatePurchaseOrder, type PurchaseOrder } from "@/lib/supabase/hooks/usePurchaseOrders";
import { PurchaseOrderModal } from "@/components/modals/PurchaseOrderModal";
import { PurchaseOrderActionsModal, PO_STATUS_COLORS } from "@/components/modals/PurchaseOrderActionsModal";
import { fmt } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { BackLink } from "@/components/ui/BackLink";

// Filter pills follow this order; only statuses actually in use get a pill.
const STATUS_ORDER = ["pending", "acknowledged", "fulfilled", "cancelled"];

const poNo = (po: PurchaseOrder) => parseInt((po.doc_number ?? "").replace(/\D/g, ""), 10) || 0;

export function PurchaseOrdersView() {
  const access = useToolAccess("purchaseorder");
  const { data: pos, isLoading } = usePurchaseOrders();
  const updatePO = useUpdatePurchaseOrder();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sort, setSort] = useState<"az" | "number" | "recent">("az");

  const presentStatuses = STATUS_ORDER.filter((s) => (pos ?? []).some((p) => p.status === s));

  const filtered = (pos ?? [])
    .filter((po) => {
      if (statusFilter !== "all" && po.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!po.supplier_name.toLowerCase().includes(s) && !(po.doc_number ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "az") return a.supplier_name.localeCompare(b.supplier_name);
      if (sort === "number") return poNo(a) - poNo(b);
      return (b.created_at ?? b.issue_date ?? "").localeCompare(a.created_at ?? a.issue_date ?? "");
    });

  // The soft delete the other list tools have. "Cancel PO" in the actions modal
  // is the other thing you might want and stays where it is: cancelling keeps the
  // order on file with a cancelled status, this takes the row away entirely.
  const handleSoftDelete = (po: PurchaseOrder) => {
    if (!confirm(`Remove purchase order ${po.doc_number ?? ""} to ${po.supplier_name}?\n\nTo keep it on file as cancelled, open it and use “✕ Cancel PO” instead.`)) return;
    updatePO.mutate({ id: po.id, changes: { deleted_at: new Date().toISOString() } });
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Purchase Orders</h1>
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

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="purchase orders" />}

      {!isLoading && (pos ?? []).length > 0 && (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search purchase orders..."
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, boxSizing: "border-box", marginBottom: 12, background: "#fff" }}
          />

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
                    {s === "all" ? "All" : s}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (pos ?? []).length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No purchase orders yet.</p>
      )}
      {!isLoading && (pos ?? []).length > 0 && filtered.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No purchase orders match your search.</p>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "0 0 10px 2px" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {filtered.length}
            {filtered.length !== (pos ?? []).length ? ` of ${(pos ?? []).length}` : ""} order{(pos ?? []).length === 1 ? "" : "s"}
          </span>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
            {(["az", "number", "recent"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: sort === s ? "#fff" : "transparent", color: sort === s ? "#0C4A6E" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: sort === s ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
              >
                {s === "az" ? "A–Z" : s === "number" ? "Number" : "Recent"}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.map((po) => {
        const color = PO_STATUS_COLORS[po.status] ?? PO_STATUS_COLORS.pending;
        const totalInclVat = Number(po.total_amount) + Number(po.vat_amount ?? 0);
        return (
          // The Customers row: tap the body to open, ✕ to remove.
          <div
            key={po.id}
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
            <button
              onClick={() => setSelected(po)}
              style={{
                flex: 1,
                minWidth: 0,
                background: "none",
                border: "none",
                padding: 0,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{po.supplier_name}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  {po.doc_number} · {po.issue_date}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#0C4A6E" }}>{fmt(totalInclVat)}</div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: color.bg, color: color.fg, textTransform: "uppercase" }}>
                  {po.status}
                </span>
              </div>
            </button>
            {access.canDelete && (
              <button
                onClick={() => handleSoftDelete(po)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 4, marginLeft: 4 }}
                aria-label="Remove purchase order"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      {showNew && <PurchaseOrderModal onClose={() => setShowNew(false)} />}
      {editing && <PurchaseOrderModal po={editing} onClose={() => setEditing(null)} />}
      {selected && (
        <PurchaseOrderActionsModal
          po={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
