"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { useUpdateBusinessProfile, type BusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";

export function BusinessTaxDetailsModal({ business, onClose }: { business: BusinessProfile; onClose: () => void }) {
  const updateProfile = useUpdateBusinessProfile();
  const [vatNumber, setVatNumber] = useState(business.vat_number ?? "");
  const [vatPeriod, setVatPeriod] = useState(business.vat_period ?? "Bi-monthly");
  const [payeRef, setPayeRef] = useState(business.paye_ref ?? "");
  const [sdlRegistered, setSdlRegistered] = useState(business.sdl_registered ?? false);
  const [error, setError] = useState("");

  const handleSave = () => {
    setError("");
    updateProfile.mutate(
      {
        id: business.id,
        changes: {
          vat_number: vatNumber.trim() || null,
          vat_period: vatPeriod,
          paye_ref: payeRef.trim() || null,
          sdl_registered: sdlRegistered,
        },
      },
      {
        onSuccess: () => onClose(),
        onError: (e) => setError(e instanceof Error ? e.message : "Couldn't save."),
      }
    );
  };

  return (
    <Modal title="Business tax details" onClose={onClose}>
      <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
        These determine which SARS returns apply to you. Leave blank whatever you&apos;re not registered for.
      </div>

      <Field label="VAT number">
        <Input value={vatNumber} onChange={setVatNumber} placeholder="Leave blank if not VAT registered" />
      </Field>

      {vatNumber.trim() && (
        <Field label="VAT period">
          <Chips options={["Monthly", "Bi-monthly"]} selected={vatPeriod} onSelect={(v) => v && setVatPeriod(v)} />
        </Field>
      )}

      <Field label="PAYE reference number">
        <Input value={payeRef} onChange={setPayeRef} placeholder="From SARS eFiling — needed for EMP201" />
      </Field>

      <Field label="SDL (Skills Development Levy)">
        <button
          type="button"
          onClick={() => setSdlRegistered((p) => !p)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "12px 14px",
            borderRadius: 12,
            border: `1.5px solid ${sdlRegistered ? "#0C4A6E" : "#e2e8f0"}`,
            background: sdlRegistered ? "#F0F9FF" : "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18 }}>{sdlRegistered ? "✅" : "⬜"}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: sdlRegistered ? "#0C4A6E" : "#111" }}>Registered for SDL</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Required once your annual payroll exceeds R500,000</div>
          </div>
        </button>
      </Field>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={updateProfile.isPending ? "Saving..." : "Save details"} icon="💾" onClick={handleSave} disabled={updateProfile.isPending} />
    </Modal>
  );
}
