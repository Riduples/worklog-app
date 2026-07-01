"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { ContactPicker } from "@/components/ui/ContactPicker";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";
import { SarsSuggestionDropdown } from "@/components/ui/SarsSuggestionDropdown";
import { getSarsIncomeMatch, type SarsCategory } from "@/lib/sarsCategories";
import { fmt, todayStr } from "@/lib/format";
import { useCreateIncome } from "@/lib/supabase/hooks/useIncome";
import { useContacts } from "@/lib/supabase/hooks/useContacts";

export function IncomeModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [whatFor, setWhatFor] = useState("");
  const [sarsCategory, setSarsCategory] = useState<SarsCategory | null>(null);
  const [showSarsSuggestions, setShowSarsSuggestions] = useState(false);
  const [receivedFrom, setReceivedFrom] = useState("");
  const [receivedFromContactId, setReceivedFromContactId] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [method, setMethod] = useState("Cash");
  const [date, setDate] = useState(todayStr());
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const createIncome = useCreateIncome();

  const amountNum = parseFloat(amount) || 0;
  const taxJar = amountNum * 0.28;

  const handleSave = () => {
    if (!amountNum || amountNum <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setError("");

    createIncome.mutate(
      {
        amount: amountNum,
        what_for: whatFor.trim() || null,
        sars_category: sarsCategory?.sars ?? null,
        details: details.trim() || null,
        received_from: receivedFrom.trim() || null,
        received_from_contact_id: receivedFromContactId,
        payment_method: method || null,
        transaction_date: date,
        tax_jar_amount: taxJar,
        source: "manual",
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal title="Log income" onClose={onClose}>
      <Field label="Amount">
        <Input value={amount} onChange={setAmount} type="number" placeholder="0.00" autoFocus />
      </Field>

      <div style={{ position: "relative" }}>
        <Field label="What for?">
          <Input
            value={whatFor}
            onChange={(v) => {
              setWhatFor(v);
              setShowSarsSuggestions(true);
              setSarsCategory(null);
            }}
            placeholder="e.g. Gate fix, braai catering"
          />
        </Field>
        {showSarsSuggestions && (
          <SarsSuggestionDropdown
            suggestions={getSarsIncomeMatch(whatFor)}
            onPick={(s) => {
              setSarsCategory(s);
              setWhatFor(s.label);
              setShowSarsSuggestions(false);
            }}
          />
        )}
      </div>

      <ContactPicker
        label="Received from"
        value={receivedFrom}
        onChange={(v, id) => {
          setReceivedFrom(v);
          setReceivedFromContactId(id);
        }}
        contacts={contacts ?? []}
        placeholder="Name (optional)"
      />

      <PaymentMethodPicker selected={method} onSelect={setMethod} />

      <Field label="Date">
        <Input value={date} onChange={setDate} type="date" />
      </Field>

      <Field label="Details (optional)">
        <Input value={details} onChange={setDetails} placeholder="Extra description" />
      </Field>

      {amountNum > 0 && (
        <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#166534" }}>
          🏦 {fmt(taxJar)} set aside for SARS (28% tax jar)
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={createIncome.isPending ? "Saving..." : "Log income"} onClick={handleSave} disabled={createIncome.isPending} />
    </Modal>
  );
}
