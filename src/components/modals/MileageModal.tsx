"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { fmt, todayStr } from "@/lib/format";
import { useTaxRates } from "@/lib/taxRates";
import { useBookings } from "@/lib/supabase/hooks/useBookings";
import { useCreateMileageTrip, useUpdateMileageTrip, type MileageTrip } from "@/lib/supabase/hooks/useMileage";

const TRIP_TYPES = ["Customer visit", "Supplier visit", "Other"];

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

export function MileageModal({ trip, onClose }: { trip?: MileageTrip; onClose: () => void }) {
  const isEdit = !!trip;
  const [odoStart, setOdoStart] = useState(trip ? String(trip.odometer_start) : "");
  const [odoEnd, setOdoEnd] = useState(trip ? String(trip.odometer_end) : "");
  const [tripType, setTripType] = useState(trip?.trip_type ?? "Customer visit");
  const [purpose, setPurpose] = useState(trip?.purpose ?? "");
  const [tripDate, setTripDate] = useState(trip?.trip_date ?? todayStr());
  const [bookingId, setBookingId] = useState<string>(trip?.booking_id ?? "");
  const [error, setError] = useState("");

  const { MILEAGE_RATE } = useTaxRates();
  const { data: bookings } = useBookings();
  const createTrip = useCreateMileageTrip();
  const updateTrip = useUpdateMileageTrip();
  const saving = createTrip.isPending || updateTrip.isPending;

  const startNum = parseFloat(odoStart) || 0;
  const endNum = parseFloat(odoEnd) || 0;
  const km = Math.max(0, endNum - startNum);
  const deduction = km * MILEAGE_RATE;

  // Diary appointments to log a drive against (a cancelled one is not a real trip).
  const openBookings = (bookings ?? []).filter((b) => b.status !== "cancelled");
  const selectedBooking = bookingId ? openBookings.find((b) => b.id === bookingId) ?? null : null;

  const applyBooking = (id: string) => {
    setBookingId(id);
    const b = (bookings ?? []).find((x) => x.id === id);
    if (!b) return;
    // Auto-fill date, purpose and trip type from the appointment, mirroring v126.
    setTripDate(b.booking_date ?? todayStr());
    setTripType(b.appt_type === "supplier" ? "Supplier visit" : "Customer visit");
    setPurpose(b.purpose || b.service || `${b.appt_type === "supplier" ? "Supplier" : "Customer"} visit — ${b.client_name}`);
  };

  const handleSave = () => {
    if (!odoStart || !odoEnd) {
      setError("Enter both odometer readings.");
      return;
    }
    if (endNum <= startNum) {
      setError("End reading must be higher than start.");
      return;
    }
    setError("");

    const values = {
      odometer_start: startNum,
      odometer_end: endNum,
      km_travelled: km,
      trip_type: tripType,
      purpose: purpose.trim() || null,
      sars_deduction: deduction,
      trip_date: tripDate,
      booking_id: bookingId || null,
    };

    // Editing only ever touches this trip row. Any SARS expense the trip is
    // linked to keeps what it already claimed — we don't touch or duplicate it.
    if (isEdit) updateTrip.mutate({ id: trip.id, changes: values }, { onSuccess: onClose });
    else createTrip.mutate(values, { onSuccess: onClose });
  };

  return (
    <Modal title={isEdit ? "Edit trip" : "New trip"} onClose={onClose}>
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
          ✅ Date and purpose auto-filled from diary appointment
        </div>
      )}

      {/* WHAT — the kind of trip and what it was for. */}
      <Field label="Trip type">
        <Chips options={TRIP_TYPES} selected={tripType} onSelect={(v) => v && setTripType(v)} />
      </Field>

      <Field label="Purpose - optional">
        <Input value={purpose} onChange={setPurpose} placeholder="e.g. Site visit, Quote delivery, Pick up materials…" />
      </Field>

      {/* WHEN */}
      <Field label="Date">
        <Input value={tripDate} onChange={setTripDate} type="date" />
      </Field>

      {/* HOW FAR — odometer readings; the SARS deduction is worked out below. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Start odometer (km)">
          <Input value={odoStart} onChange={setOdoStart} type="number" placeholder="e.g. 85430" autoFocus />
        </Field>
        <Field label="End odometer (km)">
          <Input value={odoEnd} onChange={setOdoEnd} type="number" placeholder="e.g. 85487" />
        </Field>
      </div>

      {km > 0 && (
        <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: "#38BDF8" }}>Distance</span>
            <span style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>{km.toFixed(1)} km</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "#38BDF8" }}>SARS deduction @ R{MILEAGE_RATE.toFixed(2)}/km</span>
            <span style={{ fontSize: 18, color: "#F59E0B", fontWeight: 900 }}>{fmt(deduction)}</span>
          </div>
          <div style={{ fontSize: 10, color: "#7DD3FC", marginTop: 6 }}>Recorded as a SARS travel deduction — shows on your Travel Report</div>
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : isEdit ? "Update Trip" : "Log Trip"} icon="🚗" onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
