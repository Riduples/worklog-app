"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { ContactPicker } from "@/components/ui/ContactPicker";
import { SalesLineItemsEditor } from "@/components/ui/SalesLineItemsEditor";
import { salesLinesSubtotal } from "@/lib/lineItems";
import { fmt, todayStr } from "@/lib/format";
import { useTaxRates } from "@/lib/taxRates";
import { getNextDocNumber } from "@/lib/docNumber";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useCreateQuote, useUpdateQuote, type Quote, type QuoteLineItem } from "@/lib/supabase/hooks/useQuotes";
import { createClient } from "@/lib/supabase/client";

const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

export function QuoteModal({ quote, onClose }: { quote?: Quote; onClose: () => void }) {
  const isEdit = !!quote;
  const existingItems = (quote?.line_items as QuoteLineItem[] | null) ?? null;
  const [client, setClient] = useState(quote?.client_name ?? "");
  const [clientContactId, setClientContactId] = useState<string | null>(quote?.client_contact_id ?? null);
  const [issueDate, setIssueDate] = useState(quote?.issue_date ?? todayStr());
  const [validUntil, setValidUntil] = useState(quote?.valid_until ?? addDays(todayStr(), 30));
  const [items, setItems] = useState<QuoteLineItem[]>(
    existingItems && existingItems.length ? existingItems : [{ desc: "", qty: 1, unit_price: 0 }]
  );
  const [deposit, setDeposit] = useState(String(quote?.deposit_requested ?? 0));
  const [estHours, setEstHours] = useState(quote?.estimated_hours != null ? String(quote.estimated_hours) : "");
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const { data: business } = useBusinessProfile();
  const { VAT_RATE } = useTaxRates();
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const saving = createQuote.isPending || updateQuote.isPending;

  const subtotal = salesLinesSubtotal(items);
  const isVatRegistered = !!business?.vat_number;
  const vatAmount = isVatRegistered ? subtotal * VAT_RATE : 0;
  const totalInclVat = subtotal + vatAmount;
  const depositNum = parseFloat(deposit) || 0;

  const handleSave = async () => {
    if (!client.trim()) {
      setError("Customer is required.");
      return;
    }
    if (!items.some((it) => it.desc || it.unit_price || it.labour || it.materials)) {
      setError("Add at least one line item.");
      return;
    }
    if (!business) return;
    setError("");

    const lineItems = items.filter((it) => it.desc || it.unit_price || it.labour || it.materials);

    if (isEdit) {
      // Keep the original doc_number & status — an edit only revises the content.
      updateQuote.mutate(
        {
          id: quote.id,
          changes: {
            client_contact_id: clientContactId,
            client_name: client.trim(),
            line_items: lineItems,
            total_amount: subtotal,
            deposit_requested: depositNum,
            issue_date: issueDate,
            valid_until: validUntil,
            estimated_hours: parseFloat(estHours) || null,
            vat_rate: isVatRegistered ? VAT_RATE : null,
            vat_amount: vatAmount,
          },
        },
        { onSuccess: onClose }
      );
      return;
    }

    const supabase = createClient();
    const docNumber = await getNextDocNumber(supabase, business.id, "QTE");

    createQuote.mutate(
      {
        doc_number: docNumber,
        client_contact_id: clientContactId,
        client_name: client.trim(),
        line_items: lineItems,
        total_amount: subtotal,
        deposit_requested: depositNum,
        issue_date: issueDate,
        valid_until: validUntil,
        estimated_hours: parseFloat(estHours) || null,
        status: "pending",
        vat_rate: isVatRegistered ? VAT_RATE : null,
        vat_amount: vatAmount,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal title={isEdit ? "Edit quote" : "New quote"} onClose={onClose}>
      <ContactPicker
        label="Customer / Company name"
        value={client}
        onChange={(v, id) => {
          setClient(v);
          setClientContactId(id);
        }}
        contacts={contacts ?? []}
        placeholder="Customer name — or pick from your customers"
      />

      <Field label="Issue date">
        <Input value={issueDate} onChange={setIssueDate} type="date" />
      </Field>

      <Field label="Valid until">
        <Input value={validUntil} onChange={setValidUntil} type="date" />
      </Field>

      <SalesLineItemsEditor items={items} onChange={setItems} />

      <Field label="Deposit requested">
        <Input value={deposit} onChange={setDeposit} type="number" placeholder="0.00" />
      </Field>

      <Field label="Estimated hours for this job (optional)">
        <Input value={estHours} onChange={setEstHours} type="number" placeholder="e.g. 30" />
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Link time entries to this quote to track hours logged vs quoted.</div>
      </Field>

      <div style={{ background: "#F0F9FF", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#0369A1" }}>
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
            <span>Deposit requested</span>
            <span>−{fmt(depositNum)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, marginTop: 6, paddingTop: 6, borderTop: "1.5px solid #BAE6FD" }}>
          <span>Total{isVatRegistered ? " (incl. VAT)" : ""}</span>
          <span>{fmt(totalInclVat)}</span>
        </div>
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : "Save quote"} onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
