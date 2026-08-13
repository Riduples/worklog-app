"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import {
  useBusinessProfile,
  useUpdateBusinessProfile,
  type BusinessProfile,
} from "@/lib/supabase/hooks/useBusinessProfile";
import { useLogbookYears, useUpsertLogbookYear, type LogbookYear } from "@/lib/supabase/hooks/useLogbook";
import {
  currentTaxYearStartYear,
  taxYearStartYearOf,
  taxYearRange,
  taxYearDateLabel,
} from "@/lib/period";

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

// The one-time vehicle record and the per-tax-year opening/closing odometer that,
// together with the trips already logged, make the Travel Report a complete SARS
// logbook for the per-km method. Opened from the Travel Log.
//
// This outer shell waits for the profile and the stored years to load, then hands
// them to the form as props so every field can seed from a useState initialiser —
// no seeding effects, which the codebase's lint (rightly) rejects.
export function VehicleLogbookModal({ onClose }: { onClose: () => void }) {
  const { data: business } = useBusinessProfile();
  const { data: years } = useLogbookYears();

  if (!business || years === undefined) {
    return (
      <Modal title="Vehicle & logbook" onClose={onClose}>
        <p style={{ color: "#94a3b8", fontSize: 13, padding: "20px 0" }}>Loading…</p>
      </Modal>
    );
  }
  return <LogbookForm business={business} years={years} onClose={onClose} />;
}

function readingsFor(years: LogbookYear[], startYear: number): { opening: string; closing: string } {
  const rec = years.find((r) => taxYearStartYearOf(r.tax_year_start) === startYear);
  return {
    opening: rec?.opening_odometer != null ? String(rec.opening_odometer) : "",
    closing: rec?.closing_odometer != null ? String(rec.closing_odometer) : "",
  };
}

function LogbookForm({ business, years, onClose }: { business: BusinessProfile; years: LogbookYear[]; onClose: () => void }) {
  const updateProfile = useUpdateBusinessProfile();
  const upsertYear = useUpsertLogbookYear();
  const saving = updateProfile.isPending || upsertYear.isPending;

  const firstYear = currentTaxYearStartYear();
  const seed = readingsFor(years, firstYear);

  const [vehicleDesc, setVehicleDesc] = useState(business.vehicle_description ?? "");
  const [vehicleReg, setVehicleReg] = useState(business.vehicle_registration ?? "");
  const [taxYearStart, setTaxYearStart] = useState(firstYear);
  const [opening, setOpening] = useState(seed.opening);
  const [closing, setClosing] = useState(seed.closing);
  const [error, setError] = useState("");

  // Switching year swaps in that year's stored readings — done in the handler, not
  // an effect, so no cascading render.
  const handleYearChange = (y: number) => {
    setTaxYearStart(y);
    const next = readingsFor(years, y);
    setOpening(next.opening);
    setClosing(next.closing);
  };

  // Offer the current tax year and the previous five, plus any year that already
  // has readings, newest first.
  const yearSet = new Set<number>();
  for (let i = 0; i <= 5; i++) yearSet.add(firstYear - i);
  years.forEach((r) => yearSet.add(taxYearStartYearOf(r.tax_year_start)));
  const yearOptions = [...yearSet].sort((a, b) => b - a);

  const openNum = opening.trim() ? parseFloat(opening) : null;
  const closeNum = closing.trim() ? parseFloat(closing) : null;
  const totalKm = openNum != null && closeNum != null ? closeNum - openNum : null;

  const handleSave = async () => {
    if (openNum != null && closeNum != null && closeNum < openNum) {
      setError("Closing odometer must be the same as or higher than opening.");
      return;
    }
    setError("");
    try {
      await updateProfile.mutateAsync({
        id: business.id,
        changes: {
          vehicle_description: vehicleDesc.trim() || null,
          vehicle_registration: vehicleReg.trim() || null,
        },
      });
      await upsertYear.mutateAsync({
        tax_year_start: taxYearRange(taxYearStart).from, // "YYYY-03-01"
        opening_odometer: openNum,
        closing_odometer: closeNum,
      });
      onClose();
    } catch {
      setError("Could not save — please try again.");
    }
  };

  return (
    <Modal title="Vehicle & logbook" onClose={onClose}>
      <p style={{ fontSize: 12, color: "#64748b", margin: "0 2px 14px", lineHeight: 1.5 }}>
        Your vehicle and the year&apos;s opening &amp; closing odometer complete the SARS
        logbook. Enter the vehicle once; add the readings at the start (1 March) and end
        (end February) of each tax year.
      </p>

      {/* ── VEHICLE — entered once, remembered ── */}
      <Field label="Vehicle - make & model">
        <Input value={vehicleDesc} onChange={setVehicleDesc} placeholder="e.g. Toyota Hilux 2.4" />
      </Field>
      <Field label="Registration">
        <Input value={vehicleReg} onChange={setVehicleReg} placeholder="e.g. CA 123-456" />
      </Field>

      {/* ── TAX YEAR — which year these readings belong to ── */}
      <Field label="Tax year">
        <select value={taxYearStart} onChange={(e) => handleYearChange(Number(e.target.value))} style={selectStyle}>
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {taxYearDateLabel(y)}
            </option>
          ))}
        </select>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Opening odometer (1 Mar)">
          <Input value={opening} onChange={setOpening} type="number" placeholder="e.g. 84200" />
        </Field>
        <Field label="Closing odometer (end Feb)">
          <Input value={closing} onChange={setClosing} type="number" placeholder="e.g. 96850" />
        </Field>
      </div>

      {totalKm != null && (
        <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#38BDF8" }}>Total distance this tax year</span>
          <span style={{ fontSize: 18, color: totalKm >= 0 ? "#F59E0B" : "#FCA5A5", fontWeight: 900 }}>{totalKm.toFixed(1)} km</span>
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : "Save"} icon="🚗" onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
