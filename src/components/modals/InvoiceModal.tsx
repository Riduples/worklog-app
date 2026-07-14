"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { ContactPicker } from "@/components/ui/ContactPicker";
import { SalesLineItemsEditor } from "@/components/ui/SalesLineItemsEditor";
import { fmt, todayStr } from "@/lib/format";
import { useTaxRates } from "@/lib/taxRates";
import { getNextDocNumber } from "@/lib/docNumber";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useCreateInvoice, useConvertQuoteToInvoice } from "@/lib/supabase/hooks/useInvoices";
import type { Quote, QuoteLineItem } from "@/lib/supabase/hooks/useQuotes";
import { createClient } from "@/lib/supabase/client";

const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

export function InvoiceModal({ sourceQuote, onClose }: { sourceQuote?: Quote; onClose: () => void }) {
  const [client, setClient] = useState(sourceQuote?.client_name ?? "");
  const [clientContactId, setClientContactId] = useState<string | null>(sourceQuote?.client_contact_id ?? null);
  const [issueDate, setIssueDate] = useState(todayStr());
  const [dueDate, setDueDate] = useState(addDays(todayStr(), 30));
  const [items, setItems] = useState<QuoteLineItem[]>(
    (sourceQuote?.line_items as QuoteLineItem[]) ?? [{ desc: "", qty: 1, labour: 0, materials: 0 }]
  );
  const [depositReceived, setDepositReceived] = useState(String(sourceQuote?.deposit_requested ?? 0));
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const { data: business } = useBusinessProfile();
  const { VAT_RATE } = useTaxRates();
  const createInvoice = useCreateInvoice();
  const convertQuote = useConvertQuoteToInvoice();
  const saving = createInvoice.isPending || convertQuote.isPending;

  const subtotal = items.reduce((s, it) => s + Number(it.labour || 0) + Number(it.materials || 0), 0);
  const isVatRegistered = !!business?.vat_number;
  const vatAmount = isVatRegistered ? subtotal * VAT_RATE : 0;
  const totalInclVat = subtotal + vatAmount;
  const depositNum = parseFloat(depositReceived) || 0;
  const balanceDue = subtotal - depositNum;

  const handleSave = async () => {
    if (!client.trim()) {
      setError("Client is required.");
      return;
    }
    if (!items.some((it) => it.desc || it.labour || it.materials)) {
      setError("Add at least one line item.");
      return;
    }
    if (!business) return;
    setError("");

    const supabase = createClient();
    const docNumber = await getNextDocNumber(supabase, business.id, "INV");
    const filteredItems = items.filter((it) => it.desc || it.labour || it.materials);

    if (sourceQuote) {
      convertQuote.mutate(
        {
          quoteId: sourceQuote.id,
          docNumber,
          lineItems: filteredItems,
          invoiceAmount: subtotal,
          depositReceived: depositNum,
          vatRate: isVatRegistered ? VAT_RATE : null,
          vatAmount,
          issueDate,
          dueDate: dueDate || null,
        },
        { onSuccess: onClose }
      );
    } else {
      createInvoice.mutate(
        {
          doc_number: docNumber,
          client_contact_id: clientContactId,
          client_name: client.trim(),
          line_items: filteredItems,
          invoice_amount: subtotal,
          deposit_received: depositNum,
          balance_due: balanceDue,
          issue_date: issueDate,
          due_date: dueDate || null,
          status: "unpaid",
          vat_rate: isVatRegistered ? VAT_RATE : null,
          vat_amount: vatAmount,
        },
        { onSuccess: onClose }
      );
    }
  };

  return (
    <Modal title={sourceQuote ? `Convert ${sourceQuote.doc_number} to invoice` : "New invoice"} onClose={onClose}>
      <ContactPicker
        label="Client"
        value={client}
        onChange={(v, id) => {
          setClient(v);
          setClientContactId(id);
        }}
        contacts={contacts ?? []}
        placeholder="Client name"
      />

      <Field label="Issue date">
        <Input value={issueDate} onChange={setIssueDate} type="date" />
      </Field>

      <Field label="Due date">
        <Input value={dueDate} onChange={setDueDate} type="date" />
      </Field>

      <SalesLineItemsEditor items={items} onChange={setItems} />

      <Field label="Deposit already received">
        <Input value={depositReceived} onChange={setDepositReceived} type="number" placeholder="0.00" />
      </Field>

      <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#166534" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal{isVatRegistered ? " (excl. VAT)" : ""}</span>
          <span>{fmt(subtotal)}</span>
        </div>
        {isVatRegistered && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>VAT ({(VAT_RATE * 100).toFixed(0)}%)</span>
            <span>{fmt(vatAmount)}</span>
          </div>
        )}
        {depositNum > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Deposit received</span>
            <span>−{fmt(depositNum)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, marginTop: 6, paddingTop: 6, borderTop: "1.5px solid #bbf7d0" }}>
          <span>Balance due{isVatRegistered ? " (incl. VAT)" : ""}</span>
          <span>{fmt(balanceDue + vatAmount)}</span>
        </div>
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : "Save invoice"} onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
