"use client";

import { Modal } from "@/components/ui/Modal";
import { Row } from "@/components/ui/Row";
import { DocumentActions } from "@/components/ui/DocumentActions";
import { buildInvoiceText } from "@/lib/docgen/shareText";
import type { DocForRender } from "@/lib/docgen/buildDocumentHTML";
import { fmt, todayStr } from "@/lib/format";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { useUpdateInvoice, type Invoice } from "@/lib/supabase/hooks/useInvoices";

export function displayStatus(invoice: Invoice): { label: string; bg: string; fg: string } {
  if (invoice.status === "paid") return { label: "paid", bg: "#F0F9FF", fg: "#0369A1" };
  const isOverdue = !!invoice.due_date && invoice.due_date < todayStr();
  const isPartial = Number(invoice.deposit_received || 0) > 0 && Number(invoice.deposit_received || 0) < Number(invoice.invoice_amount);
  if (isOverdue) return { label: "overdue", bg: "#fee2e2", fg: "#991b1b" };
  if (isPartial) return { label: "partial", bg: "#fff7ed", fg: "#b45309" };
  return { label: "unpaid", bg: "#fff7ed", fg: "#b45309" };
}

export function InvoiceActionsModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const updateInvoice = useUpdateInvoice();
  const access = useToolAccess("invoice");
  const items = (invoice.line_items as Array<{ desc: string; qty: number; labour: number; materials: number }>) ?? [];
  const status = displayStatus(invoice);
  const totalInclVat = Number(invoice.invoice_amount) + Number(invoice.vat_amount ?? 0);
  // Marking an invoice paid zeroes balance_due but leaves vat_amount alone, so
  // adding the two would show a paid VAT invoice as still owing the VAT.
  // Nothing is outstanding once balance_due is zero.
  const balanceDue = Number(invoice.balance_due);
  const balanceInclVat = balanceDue > 0 ? balanceDue + Number(invoice.vat_amount ?? 0) : 0;

  return (
    <Modal title={invoice.doc_number} onClose={onClose}>
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

      <Row label="Client" value={invoice.client_name} />
      <Row label="Issue date" value={invoice.issue_date} />
      <Row label="Due date" value={invoice.due_date ?? "—"} />

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#374151", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
            <span>
              {it.desc} {it.qty > 1 ? `×${it.qty}` : ""}
            </span>
            <span>{fmt(Number(it.labour || 0) + Number(it.materials || 0))}</span>
          </div>
        ))}
      </div>

      <Row label="Total" value={fmt(totalInclVat)} />
      {invoice.deposit_received ? <Row label="Deposit received" value={fmt(invoice.deposit_received)} /> : null}
      <Row label="Balance due" value={fmt(balanceInclVat)} bold />

      <DocumentActions
        kind="invoice"
        sourceId={invoice.id}
        shareText={buildInvoiceText(invoice)}
        doc={
          {
            doc_number: invoice.doc_number,
            issue_date: invoice.issue_date,
            recipient_name: invoice.client_name,
            line_items: items,
            subtotal: Number(invoice.invoice_amount),
            vat_rate: invoice.vat_rate,
            vat_amount: Number(invoice.vat_amount ?? 0),
            deposit: Number(invoice.deposit_received ?? 0),
            balance_due: invoice.balance_due,
            due_date: invoice.due_date,
          } satisfies DocForRender
        }
      />

      {invoice.status !== "paid" && access.canEdit && (
        <button
          onClick={() =>
            updateInvoice.mutate(
              { id: invoice.id, changes: { status: "paid", paid_date: todayStr(), balance_due: 0 } },
              { onSuccess: onClose }
            )
          }
          style={{ width: "100%", background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 14, padding: 16, fontWeight: 700, cursor: "pointer", marginTop: 12 }}
        >
          ✅ Mark Paid
        </button>
      )}
    </Modal>
  );
}
