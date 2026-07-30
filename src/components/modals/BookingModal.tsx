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
import { useCreateBooking, useUpdateBooking, type Booking } from "@/lib/supabase/hooks/useBookings";

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

const toggleStyle = (on: boolean): React.CSSProperties => ({
  width: "100%",
  textAlign: "left",
  padding: "11px 14px",
  borderRadius: 12,
  border: `1.5px solid ${on ? "#0C4A6E" : "#e2e8f0"}`,
  background: on ? "#F0F9FF" : "#fff",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12.5,
  fontWeight: 600,
  color: on ? "#0C4A6E" : "#64748b",
  marginBottom: 12,
  lineHeight: 1.5,
});

export function BookingModal({ booking, onClose }: { booking?: Booking; onClose: () => void }) {
  const isEdit = !!booking;
  const [apptType, setApptType] = useState<"customer" | "supplier">((booking?.appt_type as "customer" | "supplier") || "customer");
  const [client, setClient] = useState(booking?.client_name ?? "");
  const [clientContactId, setClientContactId] = useState<string | null>(booking?.client_contact_id ?? null);
  const [service, setService] = useState(booking?.service ?? "");
  const [purpose, setPurpose] = useState(booking?.purpose ?? "");
  const [bookingDate, setBookingDate] = useState(booking?.booking_date ?? todayStr());
  const [bookingTime, setBookingTime] = useState(booking ? booking.booking_time ?? "" : "09:00");
  const [durationMin, setDurationMin] = useState<number | null>(booking?.duration_min ?? 60);
  const [location, setLocation] = useState(booking?.location ?? "");
  const [linkedQuoteId, setLinkedQuoteId] = useState<string | null>(booking?.linked_quote_id ?? null);
  const [notes, setNotes] = useState(booking?.notes ?? "");
  const [totalPrice, setTotalPrice] = useState(String(booking?.total_price ?? 0));
  const [depositPaid, setDepositPaid] = useState(String(booking?.deposit_paid ?? 0));
  const [isOnsite, setIsOnsite] = useState(booking?.is_onsite ?? false);
  const [distanceKm, setDistanceKm] = useState(booking?.distance_km != null ? String(booking.distance_km) : "");
  const [recurrence, setRecurrence] = useState<Recurrence>((booking?.recurrence as Recurrence) || "none");
  const [reminder, setReminder] = useState(booking?.reminder ?? false);
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const { data: quotes } = useQuotes();
  const { MILEAGE_RATE } = useTaxRates();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const createMileage = useCreateMileageTrip();
  const saving = createBooking.isPending || updateBooking.isPending;

  const totalNum = parseFloat(totalPrice) || 0;
  const depositNum = parseFloat(depositPaid) || 0;
  const balanceDue = totalNum - depositNum;
  const kmNum = parseFloat(distanceKm) || 0;
  const roundTripKm = Math.round(kmNum * 2 * 10) / 10;

  // The contact list follows the appointment type; a customer's own quotes are the
  // only ones worth attaching.
  const partyContacts = (contacts ?? []).filter((c) => c.contact_type === (apptType === "supplier" ? "supplier" : "client"));
  const clientQuotes = (quotes ?? []).filter((q) => !q.converted_to_invoice_id && (!clientContactId || q.client_contact_id === clientContactId));

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
      service: service.trim() || null,
      purpose: purpose.trim() || null,
      booking_date: bookingDate,
      booking_time: bookingTime || null,
      duration_min: durationMin,
      location: location.trim() || null,
      linked_quote_id: linkedQuoteId,
      notes: notes.trim() || null,
      total_price: totalNum,
      deposit_paid: depositNum,
      balance_due: balanceDue,
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
        onSuccess: async () => {
          // On-site visit → log the round trip's SARS-rate mileage deduction. We do
          // NOT also create a cash expense: the per-km deduction IS the travel claim,
          // and booking both would double-count. Best-effort — a failure never loses
          // the booking. Stored as odometer 0→tripKm since we only know the distance.
          if (isOnsite && roundTripKm > 0) {
            await createMileage
              .mutateAsync({
                odometer_start: 0,
                odometer_end: roundTripKm,
                km_travelled: roundTripKm,
                trip_type: apptType === "supplier" ? "Supplier visit" : "Customer visit",
                purpose: `On-site: ${service.trim() || purpose.trim() || client.trim()}`,
                sars_deduction: Math.round(roundTripKm * MILEAGE_RATE * 100) / 100,
                trip_date: bookingDate,
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
    <Modal title={isEdit ? "Edit booking" : "New booking"} onClose={onClose}>
      <Field label="Type">
        <Chips
          options={["Customer", "Supplier"]}
          selected={apptType === "supplier" ? "Supplier" : "Customer"}
          onSelect={(v) => {
            if (v) setApptType(v === "Supplier" ? "supplier" : "customer");
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
        placeholder={apptType === "supplier" ? "Supplier name" : "Customer name"}
      />

      <Field label="Service / job">
        <Input value={service} onChange={setService} placeholder="e.g. Haircut, geyser install" />
      </Field>

      <Field label="Purpose (optional)">
        <Input value={purpose} onChange={setPurpose} placeholder="e.g. Quote walkthrough, site visit" />
      </Field>

      <Field label="Date">
        <Input value={bookingDate} onChange={setBookingDate} type="date" />
      </Field>

      <Field label="Time">
        <Input value={bookingTime} onChange={setBookingTime} type="time" />
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

      <Field label="Location (optional)">
        <Input value={location} onChange={setLocation} placeholder="e.g. Customer's site, 12 Main Rd" />
      </Field>

      {apptType === "customer" && clientQuotes.length > 0 && (
        <Field label="Link to a quote (optional)">
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

      <Field label="Notes (optional)">
        <Input value={notes} onChange={setNotes} placeholder="What to bring, topics to cover…" />
      </Field>

      <Field label="Total price">
        <Input value={totalPrice} onChange={setTotalPrice} type="number" placeholder="0.00" />
      </Field>

      <Field label="Deposit paid">
        <Input value={depositPaid} onChange={setDepositPaid} type="number" placeholder="0.00" />
      </Field>

      {totalNum > 0 && (
        <div style={{ background: "#F0F9FF", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#0369A1" }}>
          Balance due on the day: <strong>{fmt(balanceDue)}</strong>
        </div>
      )}

      <button type="button" onClick={() => setIsOnsite((v) => !v)} style={toggleStyle(isOnsite)}>
        {isOnsite ? "✓ " : ""}On-site / mobile visit — auto-log the mileage &amp; SARS deduction
      </button>

      {isOnsite && (
        <Field label="Distance each way (km)">
          <Input value={distanceKm} onChange={setDistanceKm} type="number" placeholder="e.g. 15" />
          {roundTripKm > 0 && (
            <div style={{ fontSize: 11, color: "#0369A1", marginTop: 4 }}>
              Round trip {roundTripKm}km → mileage deduction {fmt(Math.round(roundTripKm * MILEAGE_RATE * 100) / 100)} logged on save.
            </div>
          )}
        </Field>
      )}

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

      <button type="button" onClick={() => setReminder((v) => !v)} style={toggleStyle(reminder)}>
        {reminder ? "✓ " : ""}Send the customer a day-before WhatsApp reminder
      </button>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : isEdit ? "Save changes" : "Save booking"} onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
