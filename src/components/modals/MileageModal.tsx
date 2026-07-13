"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { fmt, todayStr } from "@/lib/format";
import { useTaxRates } from "@/lib/taxRates";
import { useCreateMileageTrip } from "@/lib/supabase/hooks/useMileage";

const TRIP_TYPES = ["Client visit", "Materials run", "Platform trip", "Dead-head", "Business errand"];

export function MileageModal({ onClose }: { onClose: () => void }) {
  const [odoStart, setOdoStart] = useState("");
  const [odoEnd, setOdoEnd] = useState("");
  const [tripType, setTripType] = useState("Client visit");
  const [purpose, setPurpose] = useState("");
  const [tripDate, setTripDate] = useState(todayStr());
  const [error, setError] = useState("");

  const { MILEAGE_RATE } = useTaxRates();
  const createTrip = useCreateMileageTrip();

  const startNum = parseFloat(odoStart) || 0;
  const endNum = parseFloat(odoEnd) || 0;
  const km = Math.max(0, endNum - startNum);
  const deduction = km * MILEAGE_RATE;

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

    createTrip.mutate(
      {
        odometer_start: startNum,
        odometer_end: endNum,
        km_travelled: km,
        trip_type: tripType,
        purpose: purpose.trim() || null,
        sars_deduction: deduction,
        trip_date: tripDate,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal title="Log trip" onClose={onClose}>
      <Field label="Odometer start">
        <Input value={odoStart} onChange={setOdoStart} type="number" placeholder="e.g. 45230" autoFocus />
      </Field>

      <Field label="Odometer end">
        <Input value={odoEnd} onChange={setOdoEnd} type="number" placeholder="e.g. 45265" />
      </Field>

      <Field label="Trip type">
        <Chips options={TRIP_TYPES} selected={tripType} onSelect={(v) => v && setTripType(v)} />
      </Field>

      <Field label="Purpose (optional)">
        <Input value={purpose} onChange={setPurpose} placeholder="e.g. Site visit in Soweto" />
      </Field>

      <Field label="Date">
        <Input value={tripDate} onChange={setTripDate} type="date" />
      </Field>

      {km > 0 && (
        <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#166534" }}>
          {km.toFixed(1)} km · SARS deduction: <strong>{fmt(deduction)}</strong> (R{MILEAGE_RATE.toFixed(2)}/km)
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={createTrip.isPending ? "Saving..." : "Log trip"} onClick={handleSave} disabled={createTrip.isPending} />
    </Modal>
  );
}
