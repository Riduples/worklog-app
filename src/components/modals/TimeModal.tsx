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
import { useQuotes } from "@/lib/supabase/hooks/useQuotes";
import { useCreateTimeEntry, useUpdateTimeEntry, useTimeEntries, type TimeEntry } from "@/lib/supabase/hooks/useTimeEntries";

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
  const [quoteId, setQuoteId] = useState<string>(entry?.quote_id ?? "");
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const { data: quotes } = useQuotes();
  const { data: allEntries } = useTimeEntries();
  const createEntry = useCreateTimeEntry();
  const updateEntry = useUpdateTimeEntry();
  const saving = createEntry.isPending || updateEntry.isPending;

  const hoursNum = parseFloat(hours) || 0;
  const rateNum = parseFloat(rate) || 0;
  const amountToBill = billType === "Billable" ? hoursNum * rateNum : 0;

  // Live job profitability: hours already logged against the linked quote (this
  // entry excluded so an edit doesn't double-count) + this session, vs the hours
  // quoted for the job.
  const selectedQuote = (quotes ?? []).find((q) => q.id === quoteId) ?? null;
  const quoteEstHours = Number(selectedQuote?.estimated_hours ?? 0);
  const loggedOnQuote = (allEntries ?? [])
    .filter((e) => e.quote_id === quoteId && e.id !== entry?.id)
    .reduce((s, e) => s + Number(e.hours_worked || 0), 0);
  const projectedHours = loggedOnQuote + hoursNum;
  const overByHours = quoteEstHours > 0 && projectedHours > quoteEstHours ? projectedHours - quoteEstHours : 0;
  const remainingHours = quoteEstHours > 0 ? Math.max(0, quoteEstHours - projectedHours) : 0;

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
            quote_id: quoteId || null,
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
        quote_id: quoteId || null,
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

      {(quotes ?? []).length > 0 && (
        <Field label="Link to a quote (profitability, optional)">
          <select
            value={quoteId}
            onChange={(e) => setQuoteId(e.target.value)}
            style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 15, background: "#fff", boxSizing: "border-box" }}
          >
            <option value="">— No quote —</option>
            {(quotes ?? []).map((q) => (
              <option key={q.id} value={q.id}>
                {q.doc_number} · {q.client_name}
                {q.estimated_hours ? ` · ${q.estimated_hours}h quoted` : ""}
              </option>
            ))}
          </select>
        </Field>
      )}

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

      {quoteId && quoteEstHours > 0 && (
        <div
          style={{
            background: overByHours > 0 ? "#fff1f2" : "#F0F9FF",
            border: `1.5px solid ${overByHours > 0 ? "#fecdd3" : "#BAE6FD"}`,
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 16,
            fontSize: 12,
            color: overByHours > 0 ? "#be123c" : "#0369A1",
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>📊 Job profitability</div>
          {projectedHours.toFixed(1)}h projected vs {quoteEstHours.toFixed(1)}h quoted{" "}
          {overByHours > 0 ? <strong>— ⚠️ over by {overByHours.toFixed(1)}h</strong> : `— ${remainingHours.toFixed(1)}h left`}
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : isEdit ? "Save changes" : "Log time"} onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
