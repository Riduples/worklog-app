"use client";

import { Modal } from "@/components/ui/Modal";
import { Row } from "@/components/ui/Row";
import { DocumentActions } from "@/components/ui/DocumentActions";
import type { DocForRender } from "@/lib/docgen/buildDocumentHTML";
import { fmt } from "@/lib/format";
import { useUpdatePurchaseOrder, type PurchaseOrder } from "@/lib/supabase/hooks/usePurchaseOrders";
import type { PurchaseLineItem } from "@/components/ui/PurchaseLineItemsEditor";

export const PO_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "#fff7ed", fg: "#b45309" },
  acknowledged: { bg: "#e0f2fe", fg: "#0369a1" },
  fulfilled: { bg: "#F0F9FF", fg: "#0369A1" },
  cancelled: { bg: "#f1f5f9", fg: "#64748b" },
};

export function PurchaseOrderActionsModal({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const updatePO = useUpdatePurchaseOrder();
  const items = (po.line_items as PurchaseLineItem[]) ?? [];
  const color = PO_STATUS_COLORS[po.status] ?? PO_STATUS_COLORS.pending;
  const totalInclVat = Number(po.total_amount) + Number(po.vat_amount ?? 0);

  const setStatus = (status: string) => updatePO.mutate({ id: po.id, changes: { status } }, { onSuccess: onClose });

  return (
    <Modal title={po.doc_number} onClose={onClose}>
      <div style={{ marginBottom: 16 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 20,
            background: color.bg,
            color: color.fg,
            textTransform: "uppercase",
          }}
        >
          {po.status}
        </span>
      </div>

      <Row label="Supplier" value={po.supplier_name} />
      <Row label="Issue date" value={po.issue_date} />
      <Row label="Requested delivery" value={po.requested_delivery ?? "—"} />

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#374151", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
            <span>
              {it.desc} {Number(it.qty) > 1 ? `×${it.qty}` : ""}
            </span>
            <span>{fmt(Number(it.qty || 0) * Number(it.unit_price || 0))}</span>
          </div>
        ))}
      </div>

      <Row label="Total" value={fmt(totalInclVat)} bold />

      <DocumentActions
        kind="purchaseorder"
        sourceId={po.id}
        shareText={`🛒 *PURCHASE ORDER ${po.doc_number}*\n*Supplier:* ${po.supplier_name}\n*Date:* ${po.issue_date}\n*Total:* ${fmt(totalInclVat)}`}
        doc={
          {
            doc_number: po.doc_number,
            issue_date: po.issue_date,
            recipient_name: po.supplier_name,
            line_items: items,
            subtotal: Number(po.total_amount),
            vat_rate: po.vat_rate,
            vat_amount: Number(po.vat_amount ?? 0),
            deposit: 0,
            requested_delivery: po.requested_delivery,
          } satisfies DocForRender
        }
      />

      {po.status === "pending" && (
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            onClick={() => setStatus("acknowledged")}
            style={{ flex: 1, background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 12, padding: 14, fontWeight: 700, cursor: "pointer" }}
          >
            👍 Acknowledged
          </button>
          <button
            onClick={() => setStatus("cancelled")}
            style={{ flex: 1, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 12, padding: 14, fontWeight: 700, cursor: "pointer" }}
          >
            ✕ Cancel PO
          </button>
        </div>
      )}

      {po.status === "acknowledged" && (
        <button
          onClick={() => setStatus("fulfilled")}
          style={{ width: "100%", background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 14, padding: 16, fontWeight: 700, cursor: "pointer", marginTop: 12 }}
        >
          ✅ Mark Fulfilled
        </button>
      )}
    </Modal>
  );
}
