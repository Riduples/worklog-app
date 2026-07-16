"use client";

import { useState } from "react";
import Link from "next/link";
import { usePurchaseOrders, type PurchaseOrder } from "@/lib/supabase/hooks/usePurchaseOrders";
import { PurchaseOrderModal } from "@/components/modals/PurchaseOrderModal";
import { PurchaseOrderActionsModal, PO_STATUS_COLORS } from "@/components/modals/PurchaseOrderActionsModal";
import { fmt } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";

export function PurchaseOrdersView() {
  const access = useToolAccess("purchaseorder");
  const { data: pos, isLoading } = usePurchaseOrders();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <Link href="/dashboard" style={{ fontSize: 12, color: "#64748b" }}>
            ← Dashboard
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1B4332", margin: "4px 0 0" }}>Purchase Orders</h1>
        </div>
        {access.canEdit && (
          <button
            onClick={() => setShowNew(true)}
            style={{ background: "#1B4332", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + New
          </button>
        )}
      </div>

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="purchase orders" />}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (pos ?? []).length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No purchase orders yet.</p>
      )}

      {(pos ?? []).map((po) => {
        const color = PO_STATUS_COLORS[po.status] ?? PO_STATUS_COLORS.pending;
        const totalInclVat = Number(po.total_amount) + Number(po.vat_amount ?? 0);
        return (
          <button
            key={po.id}
            onClick={() => setSelected(po)}
            style={{
              width: "100%",
              background: "#fff",
              borderRadius: 13,
              padding: "12px 14px",
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              border: "none",
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
              <div style={{ fontWeight: 800, fontSize: 15, color: "#1B4332" }}>{fmt(totalInclVat)}</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: color.bg, color: color.fg, textTransform: "uppercase" }}>
                {po.status}
              </span>
            </div>
          </button>
        );
      })}

      {showNew && <PurchaseOrderModal onClose={() => setShowNew(false)} />}
      {selected && <PurchaseOrderActionsModal po={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
