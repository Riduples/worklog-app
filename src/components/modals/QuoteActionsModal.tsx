"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Row } from "@/components/ui/Row";
import { DocumentActions } from "@/components/ui/DocumentActions";
import { QuoteModal } from "@/components/modals/QuoteModal";
import { buildQuoteText } from "@/lib/docgen/shareText";
import type { DocForRender } from "@/lib/docgen/buildDocumentHTML";
import { fmt } from "@/lib/format";
import { salesLineTotal } from "@/lib/lineItems";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { useUpdateQuote, type Quote } from "@/lib/supabase/hooks/useQuotes";
import { useContacts } from "@/lib/supabase/hooks/useContacts";

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "#fff7ed", fg: "#b45309" },
  accepted: { bg: "#F0F9FF", fg: "#0369A1" },
  converted: { bg: "#e0f2fe", fg: "#0369a1" },
  declined: { bg: "#fee2e2", fg: "#991b1b" },
};

export function QuoteActionsModal({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const router = useRouter();
  const access = useToolAccess("quote");
  const updateQuote = useUpdateQuote();
  const { data: contacts } = useContacts();
  const clientAddress = (contacts ?? []).find((c) => c.id === quote.client_contact_id)?.address ?? null;
  const [editing, setEditing] = useState(false);
  const items = (quote.line_items as Array<{ desc: string; qty: number; unit_price?: number; labour?: number; materials?: number }>) ?? [];
  const statusColor = STATUS_COLORS[quote.status] ?? STATUS_COLORS.pending;
  const totalInclVat = Number(quote.total_amount) + Number(quote.vat_amount ?? 0);
  // Once a quote has been issued downstream as an invoice it's locked — editing it
  // would desync the two documents, so the edit affordance disappears.
  const isConverted = quote.status === "converted" || !!quote.converted_to_invoice_id;

  // Editing reuses the quote modal (prefilled); saving there updates in place.
  if (editing) {
    return <QuoteModal quote={quote} onClose={onClose} />;
  }

  return (
    <Modal title={quote.doc_number} onClose={onClose}>
      <div style={{ marginBottom: 16 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 20,
            background: statusColor.bg,
            color: statusColor.fg,
            textTransform: "uppercase",
          }}
        >
          {quote.status}
        </span>
      </div>

      <Row label="Client" value={quote.client_name} />
      <Row label="Issue date" value={quote.issue_date} />
      <Row label="Valid until" value={quote.valid_until ?? "—"} />

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#374151", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
            <span>
              {it.desc} {it.qty > 1 ? `×${it.qty}` : ""}
            </span>
            <span>{fmt(salesLineTotal(it))}</span>
          </div>
        ))}
      </div>

      {quote.deposit_requested ? <Row label="Deposit requested" value={fmt(quote.deposit_requested)} /> : null}
      <Row label="Total" value={fmt(totalInclVat)} bold />

      <DocumentActions
        kind="quote"
        sourceId={quote.id}
        shareText={buildQuoteText(quote)}
        doc={
          {
            doc_number: quote.doc_number,
            issue_date: quote.issue_date,
            recipient_name: quote.client_name,
            recipient_address: clientAddress,
            line_items: items,
            subtotal: Number(quote.total_amount),
            vat_rate: quote.vat_rate,
            vat_amount: Number(quote.vat_amount ?? 0),
            deposit: Number(quote.deposit_requested ?? 0),
            valid_until: quote.valid_until,
          } satisfies DocForRender
        }
      />

      {access.canEdit && !isConverted && (
        <button
          onClick={() => setEditing(true)}
          style={{
            width: "100%",
            background: "#F0F9FF",
            color: "#0C4A6E",
            border: "1.5px solid #BAE6FD",
            borderRadius: 12,
            padding: 13,
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            marginTop: 12,
          }}
        >
          ✏️ Edit quote
        </button>
      )}

      {quote.status === "pending" && (
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            onClick={() => updateQuote.mutate({ id: quote.id, changes: { status: "accepted" } }, { onSuccess: onClose })}
            style={{ flex: 1, background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 12, padding: 14, fontWeight: 700, cursor: "pointer" }}
          >
            ✅ Mark Accepted
          </button>
          <button
            onClick={() => updateQuote.mutate({ id: quote.id, changes: { status: "declined" } }, { onSuccess: onClose })}
            style={{ flex: 1, background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 12, padding: 14, fontWeight: 700, cursor: "pointer" }}
          >
            ✕ Declined
          </button>
        </div>
      )}

      {quote.status === "accepted" && (
        <button
          onClick={() => router.push(`/invoices?fromQuote=${quote.id}`)}
          style={{ width: "100%", background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 14, padding: 16, fontWeight: 700, cursor: "pointer", marginTop: 12 }}
        >
          📤 Convert to Invoice
        </button>
      )}

      {quote.status === "converted" && (
        <div style={{ background: "#e0f2fe", borderRadius: 12, padding: "12px 14px", fontSize: 13, color: "#0369a1", marginTop: 12 }}>
          Already converted to an invoice.
        </div>
      )}
    </Modal>
  );
}
