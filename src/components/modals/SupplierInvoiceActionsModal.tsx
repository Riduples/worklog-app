"use client";

import { Modal } from "@/components/ui/Modal";
import { Row } from "@/components/ui/Row";
import { fmt, todayStr } from "@/lib/format";
import { useUpdateSupplierInvoice, type SupplierInvoice } from "@/lib/supabase/hooks/useSupplierInvoices";
import type { PurchaseLineItem } from "@/components/ui/PurchaseLineItemsEditor";

export function supplierInvoiceDisplayStatus(si: SupplierInvoice): { label: string; bg: string; fg: string } {
  if (si.status === "paid") return { label: "paid", bg: "#f0fdf4", fg: "#166534" };
  const isOverdue = !!si.due_date && si.due_date < todayStr();
  if (isOverdue) return { label: "overdue", bg: "#fee2e2", fg: "#991b1b" };
  return { label: "unpaid", bg: "#fff7ed", fg: "#b45309" };
}

export function SupplierInvoiceActionsModal({ si, onClose }: { si: SupplierInvoice; onClose: () => void }) {
  const updateSI = useUpdateSupplierInvoice();
  const items = (si.line_items as PurchaseLineItem[]) ?? [];
  const status = supplierInvoiceDisplayStatus(si);
  const totalInclVat = Number(si.invoice_amount) + Number(si.vat_amount ?? 0);
  const balanceInclVat = Number(si.balance_due) + Number(si.vat_amount ?? 0);

  return (
    <Modal title={si.supplier_ref_number ? `Invoice ${si.supplier_ref_number}` : "Supplier invoice"} onClose={onClose}>
      <div style={{ marginBottom: 16 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 20,
            background: status.bg,
            color: status.fg,
            textTransform: "uppercase",
          }}
        >
          {status.label}
        </span>
      </div>

      <Row label="Supplier" value={si.supplier_name} />
      <Row label="Invoice date" value={si.issue_date} />
      <Row label="Due date" value={si.due_date ?? "—"} />

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

      <Row label="Total" value={fmt(totalInclVat)} />
      {si.paid_amount ? <Row label="Already paid" value={fmt(si.paid_amount)} /> : null}
      <Row label="Balance you owe" value={fmt(balanceInclVat)} bold />

      {si.status !== "paid" && (
        <button
          onClick={() =>
            updateSI.mutate(
              {
                id: si.id,
                changes: { status: "paid", paid_date: todayStr(), paid_amount: si.invoice_amount, balance_due: 0 },
              },
              { onSuccess: onClose }
            )
          }
          style={{ width: "100%", background: "#1B4332", color: "#fff", border: "none", borderRadius: 14, padding: 16, fontWeight: 700, cursor: "pointer", marginTop: 12 }}
        >
          ✅ Mark Paid
        </button>
      )}
    </Modal>
  );
}
