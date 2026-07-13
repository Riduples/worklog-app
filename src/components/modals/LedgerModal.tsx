"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { ContactPicker } from "@/components/ui/ContactPicker";
import { todayStr } from "@/lib/format";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useCreateLedgerEntry } from "@/lib/supabase/hooks/useLedger";

export function LedgerModal({ onClose }: { onClose: () => void }) {
  const [ledgerType, setLedgerType] = useState<"client" | "supplier">("client");
  const [partyName, setPartyName] = useState("");
  const [partyContactId, setPartyContactId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [entryDate, setEntryDate] = useState(todayStr());
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const createEntry = useCreateLedgerEntry();

  const amountNum = parseFloat(amount) || 0;
  const relevantContacts = (contacts ?? []).filter((c) => c.contact_type === ledgerType);

  const handleSave = () => {
    if (!partyName.trim()) {
      setError("Name is required.");
      return;
    }
    if (!amountNum || amountNum <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setError("");

    createEntry.mutate(
      {
        ledger_type: ledgerType,
        party_name: partyName.trim(),
        party_contact_id: partyContactId,
        amount: amountNum,
        note: note.trim() || null,
        entry_date: entryDate,
        status: "unpaid",
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal title="New ledger entry" onClose={onClose}>
      <Field label="Who owes whom?">
        <Chips
          options={["client", "supplier"]}
          selected={ledgerType}
          onSelect={(v) => v && setLedgerType(v as "client" | "supplier")}
        />
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
          {ledgerType === "client" ? "A customer owes you (credit sale)" : "You owe a supplier (bought on credit)"}
        </p>
      </Field>

      <ContactPicker
        label={ledgerType === "client" ? "Client" : "Supplier"}
        value={partyName}
        onChange={(v, id) => {
          setPartyName(v);
          setPartyContactId(id);
        }}
        contacts={relevantContacts}
        placeholder="Name"
      />

      <Field label="Amount">
        <Input value={amount} onChange={setAmount} type="number" placeholder="0.00" />
      </Field>

      <Field label="Note (optional)">
        <Input value={note} onChange={setNote} placeholder="What was it for?" />
      </Field>

      <Field label="Date">
        <Input value={entryDate} onChange={setEntryDate} type="date" />
      </Field>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={createEntry.isPending ? "Saving..." : "Save entry"} onClick={handleSave} disabled={createEntry.isPending} />
    </Modal>
  );
}
