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
import { useStockItems } from "@/lib/supabase/hooks/useStock";
import { useBookings } from "@/lib/supabase/hooks/useBookings";
import { useCreateTimeEntry, useUpdateTimeEntry, useTimeEntries, type TimeEntry } from "@/lib/supabase/hooks/useTimeEntries";

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

export function TimeModal({ entry, onClose, onShowProfitability }: { entry?: TimeEntry; onClose: () => void; onShowProfitability?: () => void }) {
  const isEdit = !!entry;
  const [client, setClient] = useState(entry?.client_name ?? "");
  const [clientContactId, setClientContactId] = useState<string | null>(entry?.client_contact_id ?? null);
  const [hours, setHours] = useState(entry ? String(entry.hours_worked) : "");
  const [otHours, setOtHours] = useState(entry?.ot_hours ? String(entry.ot_hours) : "");
  const [otMultiplier, setOtMultiplier] = useState(entry?.ot_multiplier ? String(entry.ot_multiplier) : "1.5");
  const [rate, setRate] = useState(entry?.hourly_rate != null ? String(entry.hourly_rate) : "0");
  const [billType, setBillType] = useState(entry?.bill_type ?? "Billable");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [entryDate, setEntryDate] = useState(entry?.entry_date ?? todayStr());
  const [quoteId, setQuoteId] = useState<string>(entry?.quote_id ?? "");
  const [bookingId, setBookingId] = useState<string>(entry?.booking_id ?? "");
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const { data: quotes } = useQuotes();
  const { data: stock } = useStockItems();
  const { data: bookings } = useBookings();
  const { data: allEntries } = useTimeEntries();
  const createEntry = useCreateTimeEntry();
  const updateEntry = useUpdateTimeEntry();
  const saving = createEntry.isPending || updateEntry.isPending;

  const hoursNum = parseFloat(hours) || 0;
  const otHoursNum = parseFloat(otHours) || 0;
  const otMult = parseFloat(otMultiplier) || 1.5;
  const rateNum = parseFloat(rate) || 0;
  const baseEarned = hoursNum * rateNum;
  const otEarned = otHoursNum * rateNum * otMult;
  const totalEarned = baseEarned + otEarned;
  const amountToBill = billType === "Billable" ? totalEarned : 0;
  // Rate, overtime and the rand totals only mean anything for billable time —
  // non-billable work is logged for its hours alone, so hide the money fields.
  const showEarnings = billType === "Billable";

  // Price list — only Labour-type items make sense as an hourly rate.
  const labourRates = (stock ?? []).filter((s) => s.item_type === "labour");
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
    // Auto-fill from the diary appointment, mirroring v126.
    setClient(b.client_name ?? "");
    setClientContactId(b.client_contact_id ?? null);
    setEntryDate(b.booking_date ?? todayStr());
    if (b.purpose || b.service) setDescription(b.purpose || b.service || "");
    if (b.linked_quote_id) setQuoteId(b.linked_quote_id);
  };

  // Live actual-vs-estimate hours: hours already logged against the linked quote (this
  // entry excluded so an edit doesn't double-count) + this session's base+OT, vs
  // the hours quoted for the job.
  const selectedQuote = (quotes ?? []).find((q) => q.id === quoteId) ?? null;
  const quoteEstHours = Number(selectedQuote?.estimated_hours ?? 0);
  const loggedOnQuote = (allEntries ?? [])
    .filter((e) => e.quote_id === quoteId && e.id !== entry?.id)
    .reduce((s, e) => s + Number(e.hours_worked || 0) + Number(e.ot_hours || 0), 0);
  const thisSessionHours = hoursNum + otHoursNum;
  const projectedHours = loggedOnQuote + thisSessionHours;
  const overByHours = quoteEstHours > 0 && projectedHours > quoteEstHours ? projectedHours - quoteEstHours : 0;
  const remainingHours = quoteEstHours > 0 ? Math.max(0, quoteEstHours - projectedHours) : 0;

  const handleSave = () => {
    if (!hoursNum || hoursNum <= 0) {
      setError("Enter the hours worked.");
      return;
    }
    setError("");

    if (isEdit) {
      // Scoped edit: only the purpose, date, customer and links change here.
      // Hours, overtime, rate and bill type stay put — a billable entry's figures
      // feed the billable total, and editing them after the fact would desync any
      // downstream billing.
      updateEntry.mutate(
        {
          id: entry.id,
          changes: {
            client_name: client.trim() || null,
            client_contact_id: clientContactId,
            description: description.trim() || null,
            entry_date: entryDate,
            quote_id: quoteId || null,
            booking_id: bookingId || null,
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
        // Non-billable time carries no rate/overtime — those fields are hidden
        // for it, so don't persist a stale value left over from a toggle flip.
        hourly_rate: showEarnings ? rateNum : 0,
        ot_hours: showEarnings ? otHoursNum : 0,
        ot_multiplier: otMult,
        amount_to_bill: amountToBill,
        bill_type: billType,
        description: description.trim() || null,
        entry_date: entryDate,
        quote_id: quoteId || null,
        booking_id: bookingId || null,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal title={isEdit ? "Edit time entry" : "Time Log"} onClose={onClose}>
      {!isEdit && openBookings.length > 0 && (
        <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700 }}>⏱️ Tip</span> — pick a diary appointment below to fill in the customer and date automatically.
        </div>
      )}

      {onShowProfitability && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            type="button"
            onClick={onShowProfitability}
            style={{ background: "none", border: "none", color: "#0C4A6E", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            📊 Actual vs estimate →
          </button>
        </div>
      )}

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

      {/* Date & Hours — side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Date">
          <Input value={entryDate} onChange={setEntryDate} type="date" />
        </Field>
        <Field label="Hours worked">
          {isEdit ? (
            <LockedValue value={`${hoursNum.toFixed(1)}h`} />
          ) : (
            <Input value={hours} onChange={setHours} type="number" placeholder="e.g. 4" autoFocus />
          )}
        </Field>
      </div>

      <Field label="Purpose - optional">
        <Input value={description} onChange={setDescription} placeholder="What did you work on?" />
      </Field>

      <Field label="Can you bill this?">
        {isEdit ? <LockedValue value={billType} /> : <Chips options={BILL_TYPES} selected={billType} onSelect={(v) => v && setBillType(v)} />}
      </Field>

      {/* Rate, overtime and the rand totals are billable-only — a non-billable
          entry just records its hours, so these stay hidden for it. */}
      {showEarnings && (
        <>
          <Field label="Labour hourly rate (R)">
            {isEdit ? (
              <LockedValue value={fmt(rateNum)} />
            ) : (
              <>
                <Input value={rate} onChange={setRate} type="number" placeholder="e.g. 350" />
                {labourRates.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      const s = labourRates.find((x) => x.id === e.target.value);
                      if (s) setRate(String(s.sell_price ?? s.cost_price ?? 0));
                    }}
                    style={{ ...selectStyle, marginTop: 8, fontSize: 13, color: "#64748b" }}
                  >
                    <option value="">📋 Use a price-list rate…</option>
                    {labourRates.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {fmt(s.sell_price ?? s.cost_price ?? 0)}/hr
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </Field>

          {/* Overtime — side by side */}
          {isEdit ? (
            <Field label="Overtime">
              <LockedValue value={otHoursNum > 0 ? `${otHoursNum.toFixed(1)}h × ${otMultiplier}×` : "None"} />
            </Field>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Overtime hours">
                <Input value={otHours} onChange={setOtHours} type="number" placeholder="0" />
              </Field>
              <Field label="OT rate">
                <select value={otMultiplier} onChange={(e) => setOtMultiplier(e.target.value)} style={selectStyle}>
                  <option value="1.5">1.5× — Standard OT</option>
                  <option value="2">2× — Sunday / public holiday</option>
                </select>
              </Field>
            </div>
          )}
        </>
      )}

      {/* Optional quote link — drives the live actual-vs-estimate panel below,
          so it sits just above it rather than in the middle of the billing flow. */}
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

      {isEdit && (
        <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: "#0369A1", lineHeight: 1.6 }}>
          🔒 {showEarnings ? "Hours, overtime and rate are" : "Hours are"} locked once logged — delete and re-log to change them.
        </div>
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

      {showEarnings && totalEarned > 0 && (
        <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
          {baseEarned > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#7DD3FC", marginBottom: otEarned > 0 ? 4 : 0 }}>
              <span>{hoursNum}h × {fmt(rateNum)}</span>
              <span>{fmt(baseEarned)}</span>
            </div>
          )}
          {otEarned > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#7DD3FC", marginBottom: 4 }}>
              <span>{otHoursNum}h OT × {otMultiplier}×</span>
              <span>{fmt(otEarned)}</span>
            </div>
          )}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 8, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#38BDF8", fontWeight: 700 }}>Amount to bill</span>
            <span style={{ fontSize: 20, color: "#fff", fontWeight: 900 }}>{fmt(totalEarned)}</span>
          </div>
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : isEdit ? "Save changes" : "Log Time"} icon="⏱️" onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
