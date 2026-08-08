"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { ContactPicker } from "@/components/ui/ContactPicker";
import { fmt, todayStr } from "@/lib/format";
import { useTaxRates } from "@/lib/taxRates";
import { RECURRENCE_OPTIONS, recurrenceNext, type Recurrence } from "@/lib/recurrence";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useQuotes } from "@/lib/supabase/hooks/useQuotes";
import { useCreateMileageTrip } from "@/lib/supabase/hooks/useMileage";
import { useBookings, useCreateBooking, useUpdateBooking, type Booking } from "@/lib/supabase/hooks/useBookings";

const DURATIONS = [
  { min: 30, label: "30 min" },
  { min: 45, label: "45 min" },
  { min: 60, label: "1 hour" },
  { min: 90, label: "1.5 hours" },
  { min: 120, label: "2 hours" },
  { min: 180, label: "3 hours" },
  { min: 240, label: "4 hours" },
];

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1.5px solid #e2e8f0",
  fontSize: 14,
  fontFamily: "inherit",
  background: "#fff",
  boxSizing: "border-box",
};

// "HH:MM" → minutes past midnight, or null if unparseable.
function toMinutes(t: string): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// The appointment's end time as "HH:MM", start + duration, wrapping past midnight.
function endTime(start: string, durationMin: number): string {
  const s = toMinutes(start);
  if (s == null) return "";
  const total = (s + (durationMin || 0)) % 1440;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** v126 pill-switch toggle — a labelled row with an animated on/off track. */
function SwitchToggle({
  on,
  onToggle,
  title,
  subtitle,
  activeBg,
  activeBorder,
  activeText,
  trackOn,
}: {
  on: boolean;
  onToggle: () => void;
  title: string;
  subtitle: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  trackOn: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: "100%",
        background: on ? activeBg : "#f8fafc",
        border: `1.5px solid ${on ? activeBorder : "#e2e8f0"}`,
        borderRadius: 10,
        padding: "12px 14px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        cursor: "pointer",
        marginBottom: 4,
      }}
    >
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: on ? activeText : "#64748b" }}>{title}</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{subtitle}</div>
      </div>
      <div style={{ width: 40, height: 22, borderRadius: 11, background: on ? trackOn : "#e2e8f0", position: "relative", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "left 0.2s" }} />
      </div>
    </button>
  );
}

export function BookingModal({ booking, onClose }: { booking?: Booking; onClose: () => void }) {
  const isEdit = !!booking;
  const [apptType, setApptType] = useState<"customer" | "supplier">((booking?.appt_type as "customer" | "supplier") || "customer");
  const [client, setClient] = useState(booking?.client_name ?? "");
  const [clientContactId, setClientContactId] = useState<string | null>(booking?.client_contact_id ?? null);
  const [purpose, setPurpose] = useState(booking?.purpose ?? "");
  const [bookingDate, setBookingDate] = useState(booking?.booking_date ?? todayStr());
  const [bookingTime, setBookingTime] = useState(booking ? booking.booking_time ?? "" : "09:00");
  const [durationMin, setDurationMin] = useState<number | null>(booking?.duration_min ?? 60);
  const [location, setLocation] = useState(booking?.location ?? "");
  const [linkedQuoteId, setLinkedQuoteId] = useState<string | null>(booking?.linked_quote_id ?? null);
  const [notes, setNotes] = useState(booking?.notes ?? "");
  const [isOnsite, setIsOnsite] = useState(booking?.is_onsite ?? false);
  const [distanceKm, setDistanceKm] = useState(booking?.distance_km != null ? String(booking.distance_km) : "");
  const [recurrence, setRecurrence] = useState<Recurrence>((booking?.recurrence as Recurrence) || "none");
  const [reminder, setReminder] = useState(booking?.reminder ?? false);
  // Open the extras drawer straight away when editing a booking that already has any.
  const [showExtras, setShowExtras] = useState(
    !!(booking && (booking.purpose || booking.location || booking.notes || booking.linked_quote_id || booking.is_onsite))
  );
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const { data: quotes } = useQuotes();
  const { data: allBookings } = useBookings();
  const { MILEAGE_RATE } = useTaxRates();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const createMileage = useCreateMileageTrip();
  const saving = createBooking.isPending || updateBooking.isPending;

  const kmNum = parseFloat(distanceKm) || 0;
  const roundTripKm = Math.round(kmNum * 2 * 10) / 10;

  // The contact list follows the appointment type; a customer's own quotes are the
  // only ones worth attaching.
  const partyContacts = (contacts ?? []).filter((c) => c.contact_type === (apptType === "supplier" ? "supplier" : "client"));
  const clientQuotes = (quotes ?? []).filter((q) => !q.converted_to_invoice_id && (!clientContactId || q.client_contact_id === clientContactId));
  const linkedQuote = linkedQuoteId ? (quotes ?? []).find((q) => q.id === linkedQuoteId) ?? null : null;

  // Double-booking guard — flag another live appointment whose time window overlaps
  // this one on the same day. Needs both a start time and a duration to compare.
  const newStart = toMinutes(bookingTime);
  const newEnd = newStart != null ? newStart + (durationMin ?? 60) : null;
  const hasConflict =
    newStart != null &&
    newEnd != null &&
    (allBookings ?? []).some((b) => {
      if (b.id === booking?.id) return false;
      if (b.status === "cancelled") return false;
      if (b.booking_date !== bookingDate) return false;
      const bs = toMinutes(b.booking_time ?? "");
      if (bs == null) return false;
      const be = bs + (b.duration_min ?? 60);
      return newStart < be && newEnd > bs;
    });

  const handleSave = async () => {
    if (!client.trim()) {
      setError(`${apptType === "supplier" ? "Supplier" : "Customer"} is required.`);
      return;
    }
    setError("");

    const changes = {
      appt_type: apptType,
      client_name: client.trim(),
      client_contact_id: clientContactId,
      purpose: purpose.trim() || null,
      booking_date: bookingDate,
      booking_time: bookingTime || null,
      duration_min: durationMin,
      location: location.trim() || null,
      linked_quote_id: linkedQuoteId,
      notes: notes.trim() || null,
      is_onsite: isOnsite,
      distance_km: isOnsite && kmNum > 0 ? kmNum : null,
      recurrence,
      reminder,
    };

    // Editing updates ONLY this one booking and never calls createBooking, so the
    // one-time side-effects below (the recurring series, the on-site mileage log)
    // can't fire a second time and spawn duplicates.
    if (isEdit) {
      updateBooking.mutate({ id: booking.id, changes: { ...changes, status: booking.status } }, { onSuccess: onClose });
      return;
    }

    createBooking.mutate(
      { ...changes, status: "confirmed" },
      {
        onSuccess: async (created) => {
          // On-site visit → log the round trip's SARS-rate mileage deduction. We do
          // NOT also create a cash expense: the per-km deduction IS the travel claim,
          // and booking both would double-count. Best-effort — a failure never loses
          // the booking. Stored as odometer 0→tripKm since we only know the distance,
          // and linked back to this booking for traceability.
          if (isOnsite && roundTripKm > 0) {
            await createMileage
              .mutateAsync({
                odometer_start: 0,
                odometer_end: roundTripKm,
                km_travelled: roundTripKm,
                trip_type: apptType === "supplier" ? "Supplier visit" : "Customer visit",
                purpose: `On-site: ${purpose.trim() || client.trim()}`,
                sars_deduction: Math.round(roundTripKm * MILEAGE_RATE * 100) / 100,
                trip_date: bookingDate,
                booking_id: created.id,
              })
              .catch(() => {});
          }
          // Recurring → pre-generate the next occurrences so they show on the diary.
          // Each copy is a plain one-off (recurrence 'none', no on-site auto-log) so
          // it can never re-enter this block and spawn runaway rows.
          if (recurrence !== "none") {
            let d = bookingDate;
            for (let i = 0; i < 11; i++) {
              const next = recurrenceNext(d, recurrence);
              if (!next) break;
              d = next;
              await createBooking
                .mutateAsync({ ...changes, booking_date: d, recurrence: "none", is_onsite: false, distance_km: null, status: "confirmed" })
                .catch(() => {});
            }
          }
          onClose();
        },
      }
    );
  };

  return (
    <Modal title={isEdit ? "Edit Appointment" : "New Appointment"} onClose={onClose}>
      <button
        type="button"
        onClick={onClose}
        style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 16, padding: 0 }}
      >
        ← Diary
      </button>

      <Field label="Appointment type">
        <Chips
          options={["Customer", "Supplier"]}
          selected={apptType === "supplier" ? "Supplier" : "Customer"}
          onSelect={(v) => {
            if (v) {
              setApptType(v === "Supplier" ? "supplier" : "customer");
              setLinkedQuoteId(null);
            }
          }}
        />
      </Field>

      <ContactPicker
        label={apptType === "supplier" ? "Supplier" : "Customer"}
        value={client}
        onChange={(v, id) => {
          setClient(v);
          setClientContactId(id);
        }}
        contacts={partyContacts}
        placeholder={apptType === "supplier" ? "Which supplier?" : "Who is this with?"}
      />

      {/* Date & Time — side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Date">
          <Input value={bookingDate} onChange={setBookingDate} type="date" />
        </Field>
        <Field label="Time">
          <Input value={bookingTime} onChange={setBookingTime} type="time" />
        </Field>
      </div>

      {hasConflict && (
        <div style={{ background: "#fff1f2", border: "1.5px solid #fecdd3", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#be123c", fontWeight: 600 }}>
          ⚠️ You have another appointment at this time.
        </div>
      )}

      {/* Optional extras drawer */}
      <button
        type="button"
        onClick={() => setShowExtras((p) => !p)}
        style={{ width: "100%", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Add more details</span>
        <span style={{ fontSize: 14, color: "#94a3b8" }}>{showExtras ? "▲" : "▼"}</span>
      </button>

      {showExtras && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: "14px", marginBottom: 12 }}>
          <Field label="Purpose - optional">
            <Input value={purpose} onChange={setPurpose} placeholder={apptType === "supplier" ? "e.g. Collect materials, Price discussion…" : "e.g. Quote walkthrough, Site visit…"} />
          </Field>

          <Field label="Duration">
            <select value={durationMin ?? ""} onChange={(e) => setDurationMin(e.target.value ? Number(e.target.value) : null)} style={selectStyle}>
              {DURATIONS.map((d) => (
                <option key={d.min} value={d.min}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Location - optional">
            <Input value={location} onChange={setLocation} placeholder="e.g. Customer's site, 12 Main Rd" />
          </Field>

          <SwitchToggle
            on={isOnsite}
            onToggle={() => setIsOnsite((v) => !v)}
            title="🚗 On-site / mobile visit"
            subtitle="Automatically logs a mileage trip when you save — you just add the km"
            activeBg="#fff7ed"
            activeBorder="#fed7aa"
            activeText="#92400e"
            trackOn="#F59E0B"
          />
          {isOnsite && (
            <div style={{ background: "#fff7ed", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
              <Field label="Distance each way (km)">
                <Input value={distanceKm} onChange={setDistanceKm} type="number" placeholder="e.g. 12" />
              </Field>
              {roundTripKm > 0 && (
                <div style={{ fontSize: 11, color: "#92400e", fontWeight: 600 }}>
                  Round trip {roundTripKm}km → mileage deduction {fmt(Math.round(roundTripKm * MILEAGE_RATE * 100) / 100)} (R{MILEAGE_RATE.toFixed(2)}/km) logged on save.
                </div>
              )}
            </div>
          )}

          {apptType === "customer" && clientQuotes.length > 0 && (
            <Field label="Link to a quote - optional">
              <select value={linkedQuoteId ?? ""} onChange={(e) => setLinkedQuoteId(e.target.value || null)} style={selectStyle}>
                <option value="">— None —</option>
                {clientQuotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.doc_number} · {q.client_name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Notes - optional">
            <Input value={notes} onChange={setNotes} placeholder="What to bring, topics to cover…" />
          </Field>

          {!isEdit && (
            <Field label="Repeat this booking">
              <Chips
                options={RECURRENCE_OPTIONS.map((o) => o.label)}
                selected={RECURRENCE_OPTIONS.find((o) => o.id === recurrence)?.label ?? "Once off"}
                onSelect={(label) => {
                  const opt = RECURRENCE_OPTIONS.find((o) => o.label === label);
                  if (opt) setRecurrence(opt.id);
                }}
              />
            </Field>
          )}

          <SwitchToggle
            on={reminder}
            onToggle={() => setReminder((v) => !v)}
            title="🔔 Day-before WhatsApp reminder"
            subtitle="Reminder text ready to send the day before"
            activeBg="#F0F9FF"
            activeBorder="#7DD3FC"
            activeText="#0369A1"
            trackOn="#0C4A6E"
          />
        </div>
      )}

      {/* Time-block preview */}
      {bookingTime && (
        <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "11px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#38BDF8" }}>{bookingDate}</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
            {bookingTime}
            {durationMin ? ` — ${endTime(bookingTime, durationMin)}` : ""}
          </span>
        </div>
      )}

      {linkedQuote && (
        <div style={{ fontSize: 11, color: "#0369A1", marginBottom: 12, fontWeight: 600 }}>
          📄 Linked to {linkedQuote.doc_number}
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : isEdit ? "Update Appointment" : "Book Appointment"} icon="📓" onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
