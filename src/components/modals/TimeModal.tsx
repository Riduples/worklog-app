"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { ContactPicker } from "@/components/ui/ContactPicker";
import { fmt, todayStr } from "@/lib/format";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useCreateTimeEntry } from "@/lib/supabase/hooks/useTimeEntries";

const BILL_TYPES = ["Billable", "Non-billable", "Admin", "Travel"];

export function TimeModal({ onClose }: { onClose: () => void }) {
  const [client, setClient] = useState("");
  const [clientContactId, setClientContactId] = useState<string | null>(null);
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("0");
  const [billType, setBillType] = useState("Billable");
  const [description, setDescription] = useState("");
  const [entryDate, setEntryDate] = useState(todayStr());
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const createEntry = useCreateTimeEntry();

  const hoursNum = parseFloat(hours) || 0;
  const rateNum = parseFloat(rate) || 0;
  const amountToBill = billType === "Billable" ? hoursNum * rateNum : 0;

  const handleSave = () => {
    if (!hoursNum || hoursNum <= 0) {
      setError("Enter the hours worked.");
      return;
    }
    setError("");

    createEntry.mutate(
      {
        client_name: client.trim() || null,
        client_contact_id: clientContactId,
        hours_worked: hoursNum,
        hourly_rate: rateNum,
        amount_to_bill: amountToBill,
        bill_type: billType,
        description: description.trim() || null,
        entry_date: entryDate,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal title="Log time" onClose={onClose}>
      <ContactPicker
        label="Client (optional)"
        value={client}
        onChange={(v, id) => {
          setClient(v);
          setClientContactId(id);
        }}
        contacts={contacts ?? []}
        placeholder="Client name"
      />

      <Field label="Hours worked">
        <Input value={hours} onChange={setHours} type="number" placeholder="e.g. 2.5" autoFocus />
      </Field>

      <Field label="Hourly rate">
        <Input value={rate} onChange={setRate} type="number" placeholder="0.00" />
      </Field>

      <Field label="Type">
        <Chips options={BILL_TYPES} selected={billType} onSelect={(v) => v && setBillType(v)} />
      </Field>

      <Field label="Description (optional)">
        <Input value={description} onChange={setDescription} placeholder="What was the work?" />
      </Field>

      <Field label="Date">
        <Input value={entryDate} onChange={setEntryDate} type="date" />
      </Field>

      {amountToBill > 0 && (
        <div style={{ background: "#F0F9FF", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#0369A1" }}>
          To bill: <strong>{fmt(amountToBill)}</strong> ({hoursNum}h × {fmt(rateNum)})
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={createEntry.isPending ? "Saving..." : "Log time"} onClick={handleSave} disabled={createEntry.isPending} />
    </Modal>
  );
}
