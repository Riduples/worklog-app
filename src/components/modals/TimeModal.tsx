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
import { useQuotes } from "@/lib/supabase/hooks/useQuotes";
import { useBookings } from "@/lib/supabase/hooks/useBookings";
import { useCreateTimeEntry, useUpdateTimeEntry, useTimeEntries, loggedHours, type TimeEntry } from "@/lib/supabase/hooks/useTimeEntries";

// Billable is just an hours label — "did I do this to charge for it?" — not a
// money field. The Time Tracker records hours; pricing happens when you invoice.
const BILL_TYPES = ["Billable", "Non-billable"];

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: 12,
  border: "1.5px solid #e2e8f0",
  fontSize: 15,
  background: "#fff",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

/** Greyed placeholder box shown when the diary has nothing to pick yet. */
function EmptyPickBox({ text }: { text: string }) {
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
        background: "#f8fafc",
      }}
    >
      {text}
    </div>
  );
}

export function TimeModal({ entry, onClose }: { entry?: TimeEntry; onClose: () => void }) {
  const isEdit = !!entry;
  const [client, setClient] = useState(entry?.client_name ?? "");
  const [clientContactId, setClientContactId] = useState<string | null>(entry?.client_contact_id ?? null);
  const [hours, setHours] = useState(entry ? String(entry.hours_worked) : "");
  const [billType, setBillType] = useState(entry?.bill_type ?? "Billable");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [entryDate, setEntryDate] = useState(entry?.entry_date ?? todayStr());
  const [quoteId, setQuoteId] = useState<string>(entry?.quote_id ?? "");
  const [bookingId, setBookingId] = useState<string>(entry?.booking_id ?? "");
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const { data: quotes } = useQuotes();
  const { data: bookings } = useBookings();
  const { data: allEntries } = useTimeEntries();
  const createEntry = useCreateTimeEntry();
  const updateEntry = useUpdateTimeEntry();
  const saving = createEntry.isPending || updateEntry.isPending;

  const hoursNum = parseFloat(hours) || 0;

  // Diary appointments to log against (a cancelled one is not real work).
  const openBookings = (bookings ?? []).filter((b) => b.status !== "cancelled");
  const selectedBooking = bookingId ? openBookings.find((b) => b.id === bookingId) ?? null : null;

  // Quote link is filtered to the chosen customer — logging one job's time against
  // another job's quote is never what you want. Prefer the contact id match; fall
  // back to name when the customer was typed in free-hand.
  const clientQuotes = (quotes ?? []).filter((q) => {
    if (clientContactId) return q.client_contact_id === clientContactId;
    if (client.trim()) return (q.client_name ?? "").toLowerCase() === client.trim().toLowerCase();
    return true;
  });

  const applyBooking = (id: string) => {
    setBookingId(id);
    const b = (bookings ?? []).find((x) => x.id === id);
    if (!b) return;
    // Auto-fill from the diary appointment.
    setClient(b.client_name ?? "");
    setClientContactId(b.client_contact_id ?? null);
    setEntryDate(b.booking_date ?? todayStr());
    if (b.purpose || b.service) setDescription(b.purpose || b.service || "");
    if (b.linked_quote_id) setQuoteId(b.linked_quote_id);
  };

  // Live actual-vs-estimate hours: hours already logged against the linked quote (this
  // entry excluded so an edit doesn't double-count) + this session's hours, vs the
  // hours quoted for the job. loggedHours() counts any legacy overtime too.
  const selectedQuote = (quotes ?? []).find((q) => q.id === quoteId) ?? null;
  const quoteEstHours = Number(selectedQuote?.estimated_hours ?? 0);
  const loggedOnQuote = (allEntries ?? [])
    .filter((e) => e.quote_id === quoteId && e.id !== entry?.id)
    .reduce((s, e) => s + loggedHours(e), 0);
  const thisSessionHours = hoursNum + Number(entry?.ot_hours ?? 0);
  const projectedHours = loggedOnQuote + thisSessionHours;
  const overByHours = quoteEstHours > 0 && projectedHours > quoteEstHours ? projectedHours - quoteEstHours : 0;
  const remainingHours = quoteEstHours > 0 ? Math.max(0, quoteEstHours - projectedHours) : 0;

  const handleSave = () => {
    if (!hoursNum || hoursNum <= 0) {
      setError("Enter the hours worked.");
      return;
    }
    setError("");

    // Hours-only: no rate, overtime or amount is recorded. bill_type is just a
    // label. Money columns keep their database defaults.
    const changes = {
      client_name: client.trim() || null,
      client_contact_id: clientContactId,
      hours_worked: hoursNum,
      bill_type: billType,
      description: description.trim() || null,
      entry_date: entryDate,
      quote_id: quoteId || null,
      booking_id: bookingId || null,
    };

    if (isEdit) {
      updateEntry.mutate({ id: entry.id, changes }, { onSuccess: onClose });
    } else {
      createEntry.mutate(changes, { onSuccess: onClose });
    }
  };

  return (
    <Modal title={isEdit ? "Edit time entry" : "Time Log"} onClose={onClose}>
      {/* Diary appointment — auto-fills the details */}
      <Field label="Diary appointment">
        {openBookings.length === 0 ? (
          <EmptyPickBox text="No appointments yet — add one in Diary" />
        ) : (
          <select value={bookingId} onChange={(e) => applyBooking(e.target.value)} style={selectStyle}>
            <option value="">— Not from the diary —</option>
            {openBookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.booking_date}
                {b.booking_time ? ` · ${b.booking_time}` : ""} · {b.client_name}
                {b.service ? ` · ${b.service}` : ""}
              </option>
            ))}
          </select>
        )}
      </Field>

      {selectedBooking && (
        <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "#0369A1" }}>
          ✅ Customer{selectedBooking.linked_quote_id ? ", date, purpose and quote" : " and date"} auto-filled from diary
        </div>
      )}

      {/* WHO — who did you work for? */}
      <ContactPicker
        label="Customer"
        value={client}
        onChange={(v, id) => {
          setClient(v);
          setClientContactId(id);
        }}
        contacts={contacts ?? []}
        placeholder="Who did you work for?"
      />

      {/* WHAT — describe the job before quantifying it. */}
      <Field label="Purpose - optional">
        <Input value={description} onChange={setDescription} placeholder="What did you work on?" />
      </Field>

      {/* WHEN & HOW LONG — date and hours side by side. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Date">
          <Input value={entryDate} onChange={setEntryDate} type="date" />
        </Field>
        <Field label="Hours worked">
          <Input value={hours} onChange={setHours} type="number" placeholder="e.g. 4" autoFocus />
        </Field>
      </div>

      {/* CLASSIFY — chargeable or not. Just a label for reporting; no amount is
          recorded here — you price the work when you invoice. */}
      <Field label="Can you bill this?">
        <Chips options={BILL_TYPES} selected={billType} onSelect={(v) => v && setBillType(v)} />
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "8px 2px 0" }}>
          Just labels the hours as chargeable or not — no rand amounts are tracked here.
        </p>
      </Field>

      {/* JOB TRACKING — link to a quote to compare logged hours against the estimate. */}
      {clientQuotes.length > 0 && (
        <Field label="Link to quote (actual vs estimate hours)">
          <select value={quoteId} onChange={(e) => setQuoteId(e.target.value)} style={selectStyle}>
            <option value="">— No quote —</option>
            {clientQuotes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.doc_number} · {q.client_name}
                {q.estimated_hours ? ` · ${q.estimated_hours}h quoted` : ""}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* Live actual-vs-estimate panel — hours logged vs quoted hours */}
      {quoteId && quoteEstHours > 0 && thisSessionHours > 0 && (
        <div style={{ background: overByHours > 0 ? "#fff1f2" : "#0C4A6E", border: overByHours > 0 ? "1.5px solid #fecdd3" : "none", borderRadius: 12, padding: "12px 16px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: overByHours > 0 ? "#be123c" : "#38BDF8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
            {overByHours > 0 ? "⚠️ Over quoted hours" : "Hours vs quote"}
          </div>
          {[
            ["Quoted hours", `${quoteEstHours}h`],
            ["Logged so far", `${loggedOnQuote.toFixed(1)}h`],
            ["This session", `${thisSessionHours.toFixed(1)}h`],
          ].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: overByHours > 0 ? "#9f1239" : "#7DD3FC", marginBottom: 3 }}>
              <span>{l}</span>
              <span>{v}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${overByHours > 0 ? "#fecdd3" : "rgba(255,255,255,0.15)"}`, paddingTop: 7, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: overByHours > 0 ? "#be123c" : "#38BDF8" }}>{overByHours > 0 ? "Over by" : "Hours left after this"}</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: overByHours > 0 ? "#be123c" : "#fff" }}>{(overByHours > 0 ? overByHours : remainingHours).toFixed(1)}h</span>
          </div>
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : isEdit ? "Save changes" : "Log Time"} icon="⏱️" onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
