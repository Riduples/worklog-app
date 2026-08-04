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
    <Modal title={isEdit ? "Edit trip" : "Log trip"} onClose={onClose}>
      {openBookings.length > 0 && (
        <Field label="Diary appointment (auto-fills the details)">
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
        </Field>
      )}

      <Field label="Trip type">
        <Chips options={TRIP_TYPES} selected={tripType} onSelect={(v) => v && setTripType(v)} />
      </Field>

      <Field label="Date">
        <Input value={tripDate} onChange={setTripDate} type="date" />
      </Field>

      <Field label="Purpose - optional">
        <Input value={purpose} onChange={setPurpose} placeholder="e.g. Site visit in Soweto" />
      </Field>

      <Field label="Odometer start">
        <Input value={odoStart} onChange={setOdoStart} type="number" placeholder="e.g. 45230" autoFocus />
      </Field>

      <Field label="Odometer end">
        <Input value={odoEnd} onChange={setOdoEnd} type="number" placeholder="e.g. 45265" />
      </Field>

      {km > 0 && (
        <div style={{ background: "#F0F9FF", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#0369A1" }}>
          {km.toFixed(1)} km · SARS deduction: <strong>{fmt(deduction)}</strong> (R{MILEAGE_RATE.toFixed(2)}/km)
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : isEdit ? "Save changes" : "Log trip"} onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
