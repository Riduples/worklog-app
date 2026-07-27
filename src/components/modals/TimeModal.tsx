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
import { useCreateTimeEntry, useUpdateTimeEntry, type TimeEntry } from "@/lib/supabase/hooks/useTimeEntries";

const BILL_TYPES = ["Billable", "Non-billable"];

/** Read-only stand-in for a locked field — mirrors the Input look, greyed out. */
function LockedValue({ value }: { value: string }) {
  return (
    <div
      style={{
        width: "100%",
        padding: "13px 14px",
        borderRadius: 12,
        border: "1.5px solid #e2e8f0",
        fontSize: 15,
        boxSizing: "border-box",
        color: "#94a3b8",
        background: "#f1f5f9",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span>{value}</span>
      <span aria-hidden style={{ fontSize: 13 }}>🔒</span>
    </div>
  );
}

export function TimeModal({ entry, onClose }: { entry?: TimeEntry; onClose: () => void }) {
  const isEdit = !!entry;
  const [client, setClient] = useState(entry?.client_name ?? "");
  const [clientContactId, setClientContactId] = useState<string | null>(entry?.client_contact_id ?? null);
  const [hours, setHours] = useState(entry ? String(entry.hours_worked) : "");
  const [rate, setRate] = useState(entry?.hourly_rate != null ? String(entry.hourly_rate) : "0");
  const [billType, setBillType] = useState(entry?.bill_type ?? "Billable");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [entryDate, setEntryDate] = useState(entry?.entry_date ?? todayStr());
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const createEntry = useCreateTimeEntry();
  const updateEntry = useUpdateTimeEntry();
  const saving = createEntry.isPending || updateEntry.isPending;

  const hoursNum = parseFloat(hours) || 0;
  const rateNum = parseFloat(rate) || 0;
  const amountToBill = billType === "Billable" ? hoursNum * rateNum : 0;

  const handleSave = () => {
    if (!hoursNum || hoursNum <= 0) {
      setError("Enter the hours worked.");
      return;
    }
    setError("");

    if (isEdit) {
      // Scoped edit: only the purpose, date and linked customer change here.
      // Hours, rate and bill type stay put — a billable entry already created a
      // linked income record that isn't back-referenced, so editing those would
      // desync income, the tax jar and the P&L.
      updateEntry.mutate(
        {
          id: entry.id,
          changes: {
            client_name: client.trim() || null,
            client_contact_id: clientContactId,
            description: description.trim() || null,
            entry_date: entryDate,
          },
        },
        { onSuccess: onClose }
      );
      return;
    }

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
    <Modal title={isEdit ? "Edit time entry" : "Log time"} onClose={onClose}>
      <ContactPicker
        label="Customer (optional)"
        value={client}
        onChange={(v, id) => {
          setClient(v);
          setClientContactId(id);
        }}
        contacts={contacts ?? []}
        placeholder="Customer name"
      />

      <Field label="Date">
        <Input value={entryDate} onChange={setEntryDate} type="date" />
      </Field>

      <Field label="Hours worked">
        {isEdit ? (
          <LockedValue value={`${hoursNum.toFixed(1)}h`} />
        ) : (
          <Input value={hours} onChange={setHours} type="number" placeholder="e.g. 2.5" autoFocus />
        )}
      </Field>

      <Field label="Description (optional)">
        <Input value={description} onChange={setDescription} placeholder="What was the work?" />
      </Field>

      <Field label="Labour hourly rate">
        {isEdit ? <LockedValue value={fmt(rateNum)} /> : <Input value={rate} onChange={setRate} type="number" placeholder="0.00" />}
      </Field>

      <Field label="Type">
        {isEdit ? <LockedValue value={billType} /> : <Chips options={BILL_TYPES} selected={billType} onSelect={(v) => v && setBillType(v)} />}
      </Field>

      {isEdit && (
        <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: "#0369A1", lineHeight: 1.6 }}>
          🔒 Hours and rate are locked once logged — delete and re-log to change them.
        </div>
      )}

      {amountToBill > 0 && (
        <div style={{ background: "#F0F9FF", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#0369A1" }}>
          To bill: <strong>{fmt(amountToBill)}</strong> ({hoursNum}h × {fmt(rateNum)})
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : isEdit ? "Save changes" : "Log time"} onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
