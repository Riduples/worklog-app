"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { ContactPicker } from "@/components/ui/ContactPicker";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";
import { SarsSuggestionDropdown } from "@/components/ui/SarsSuggestionDropdown";
import { LedgerEntryMatcher, expenseSettlesEntry } from "@/components/ui/LedgerEntryMatcher";
import { getSarsMatch, type SarsCategory } from "@/lib/sarsCategories";
import { todayStr } from "@/lib/format";
import { useCreateExpense } from "@/lib/supabase/hooks/useExpenses";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useLedgerEntries, useUpdateLedgerEntry } from "@/lib/supabase/hooks/useLedger";

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
  const [matchedLedgerEntryId, setMatchedLedgerEntryId] = useState<string | null>(null);
  const [markPaid, setMarkPaid] = useState(false);
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const { data: ledgerEntries } = useLedgerEntries();
  const createExpense = useCreateExpense();
  const updateLedgerEntry = useUpdateLedgerEntry();

  const amountNum = parseFloat(amount) || 0;

  // Supplier entries only: a client entry is money owed TO the business, which
  // an expense can never settle. Settled entries stay listed so an older
  // payment can still be linked, exactly as the invoice matcher does.
  const supplierEntries = (ledgerEntries ?? []).filter((e) => e.ledger_type === "supplier");
  const matchedEntry = supplierEntries.find((e) => e.id === matchedLedgerEntryId) ?? null;
  const settlesEntry = expenseSettlesEntry(matchedEntry, amountNum);

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
        matched_ledger_entry_id: matchedLedgerEntryId,
        source: "manual",
      },
      {
        onSuccess: async () => {
          // Re-check settlesEntry rather than trusting the checkbox alone: the
          // amount can be edited after ticking it, and marking a R5,000 debt
          // settled because someone paid R50 is the kind of wrong that only
          // shows up at year end. The expense is saved either way — the link is
          // what keeps the report right, and this is only the convenience on
          // top, so a failure here must not lose the expense.
          if (matchedLedgerEntryId && markPaid && settlesEntry) {
            await updateLedgerEntry
              .mutateAsync({ id: matchedLedgerEntryId, changes: { status: "paid", paid_date: date } })
              .catch(() => {});
          }
          onClose();
        },
      }
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

      <LedgerEntryMatcher
        entries={supplierEntries}
        matchedId={matchedLedgerEntryId}
        onMatch={(id) => {
          setMatchedLedgerEntryId(id);
          if (!id) setMarkPaid(false);
        }}
        filterByParty={paidTo}
        onAutoFillParty={setPaidTo}
        expenseAmount={amountNum}
        markPaid={markPaid}
        onMarkPaidChange={setMarkPaid}
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
