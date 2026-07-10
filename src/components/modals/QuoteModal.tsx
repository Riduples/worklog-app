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
import { useCreateQuote, type QuoteLineItem } from "@/lib/supabase/hooks/useQuotes";
import { createClient } from "@/lib/supabase/client";

const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

export function QuoteModal({ onClose }: { onClose: () => void }) {
  const [client, setClient] = useState("");
  const [clientContactId, setClientContactId] = useState<string | null>(null);
  const [issueDate, setIssueDate] = useState(todayStr());
  const [validUntil, setValidUntil] = useState(addDays(todayStr(), 30));
  const [items, setItems] = useState<QuoteLineItem[]>([{ desc: "", qty: 1, labour: 0, materials: 0 }]);
  const [deposit, setDeposit] = useState("0");
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const { data: business } = useBusinessProfile();
  const { VAT_RATE } = useTaxRates();
  const createQuote = useCreateQuote();

  const subtotal = items.reduce((s, it) => s + Number(it.labour || 0) + Number(it.materials || 0), 0);
  const isVatRegistered = !!business?.vat_number;
  const vatAmount = isVatRegistered ? subtotal * VAT_RATE : 0;
  const totalInclVat = subtotal + vatAmount;
  const depositNum = parseFloat(deposit) || 0;

  const handleSave = async () => {
    if (!client.trim()) {
      setError("Client is required.");
      return;
    }
    if (!items.some((it) => it.desc || it.labour || it.materials)) {
      setError("Add at least one line item.");
      return;
    }
    setError("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const docNumber = await getNextDocNumber(supabase, user.id, "QTE");

    createQuote.mutate(
      {
        doc_number: docNumber,
        client_contact_id: clientContactId,
        client_name: client.trim(),
        line_items: items.filter((it) => it.desc || it.labour || it.materials),
        total_amount: subtotal,
        deposit_requested: depositNum,
        issue_date: issueDate,
        valid_until: validUntil,
        status: "pending",
        vat_rate: isVatRegistered ? VAT_RATE : null,
        vat_amount: vatAmount,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal title="New quote" onClose={onClose}>
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

      <Field label="Valid until">
        <Input value={validUntil} onChange={setValidUntil} type="date" />
      </Field>

      <SalesLineItemsEditor items={items} onChange={setItems} />

      <Field label="Deposit requested">
        <Input value={deposit} onChange={setDeposit} type="number" placeholder="0.00" />
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
            <span>Deposit requested</span>
            <span>−{fmt(depositNum)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, marginTop: 6, paddingTop: 6, borderTop: "1.5px solid #bbf7d0" }}>
          <span>Total{isVatRegistered ? " (incl. VAT)" : ""}</span>
          <span>{fmt(totalInclVat)}</span>
        </div>
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={createQuote.isPending ? "Saving..." : "Save quote"} onClick={handleSave} disabled={createQuote.isPending} />
    </Modal>
  );
}
