"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { ContactPicker } from "@/components/ui/ContactPicker";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";
import { SarsSuggestionDropdown } from "@/components/ui/SarsSuggestionDropdown";
import { getSarsMatch, type SarsCategory } from "@/lib/sarsCategories";
import { todayStr } from "@/lib/format";
import { useCreateExpense } from "@/lib/supabase/hooks/useExpenses";
import { useContacts } from "@/lib/supabase/hooks/useContacts";

export function ExpenseModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [whatFor, setWhatFor] = useState("");
  const [sarsCategory, setSarsCategory] = useState<SarsCategory | null>(null);
  const [showSarsSuggestions, setShowSarsSuggestions] = useState(false);
  const [paidTo, setPaidTo] = useState("");
  const [paidToContactId, setPaidToContactId] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [method, setMethod] = useState("Cash");
  const [date, setDate] = useState(todayStr());
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const createExpense = useCreateExpense();

  const amountNum = parseFloat(amount) || 0;

  const handleSave = () => {
    if (!amountNum || amountNum <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setError("");

    createExpense.mutate(
      {
        amount: amountNum,
        what_for: whatFor.trim() || null,
        sars_category: sarsCategory?.sars ?? null,
        details: details.trim() || null,
        paid_to: paidTo.trim() || null,
        paid_to_contact_id: paidToContactId,
        payment_method: method || null,
        transaction_date: date,
        source: "manual",
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal title="Log expense" onClose={onClose}>
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
            placeholder="e.g. Fuel at Engen, cement"
          />
        </Field>
        {showSarsSuggestions && (
          <SarsSuggestionDropdown
            suggestions={getSarsMatch(whatFor)}
            onPick={(s) => {
              setSarsCategory(s);
              setWhatFor(s.label);
              setShowSarsSuggestions(false);
            }}
          />
        )}
      </div>

      <ContactPicker
        label="Paid to"
        value={paidTo}
        onChange={(v, id) => {
          setPaidTo(v);
          setPaidToContactId(id);
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

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={createExpense.isPending ? "Saving..." : "Log expense"} onClick={handleSave} disabled={createExpense.isPending} />
    </Modal>
  );
}
