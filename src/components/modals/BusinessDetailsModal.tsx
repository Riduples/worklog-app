"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { BUSINESS_TYPES, coreToolsFor, type BusinessType } from "@/lib/businessTypes";
import { useUpdateBusinessProfile, type BusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";

export function BusinessDetailsModal({ business, onClose }: { business: BusinessProfile; onClose: () => void }) {
  const updateProfile = useUpdateBusinessProfile();
  const [name, setName] = useState(business.name ?? "");
  const [businessType, setBusinessType] = useState<BusinessType | "">((business.business_type as BusinessType) ?? "");
  const [showAllTools, setShowAllTools] = useState(business.show_all_tools ?? false);
  const [address, setAddress] = useState(business.address ?? "");
  const [phone, setPhone] = useState(business.phone ?? "");
  const [email, setEmail] = useState(business.email ?? "");
  const [bankName, setBankName] = useState(business.bank_name ?? "");
  const [bankAccount, setBankAccount] = useState(business.bank_account ?? "");
  const [bankBranch, setBankBranch] = useState(business.bank_branch ?? "");
  const [bankRef, setBankRef] = useState(business.bank_ref ?? "");
  const [error, setError] = useState("");

  // Preview the effect of the current choices rather than making the owner save
  // and go hunting. coreToolsFor is the same function the dashboard filters on,
  // so this can't claim something the home screen won't do.
  const preview = coreToolsFor({ business_type: businessType || null, show_all_tools: showAllTools });

  const handleSave = () => {
    setError("");
    updateProfile.mutate(
      {
        id: business.id,
        changes: {
          name: name.trim(),
          business_type: businessType || null,
          show_all_tools: showAllTools,
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          bank_name: bankName.trim() || null,
          bank_account: bankAccount.trim() || null,
          bank_branch: bankBranch.trim() || null,
          bank_ref: bankRef.trim() || null,
        },
      },
      {
        onSuccess: () => onClose(),
        onError: (e) => setError(e instanceof Error ? e.message : "Couldn't save."),
      }
    );
  };

  return (
    <Modal title="Business details" onClose={onClose}>
      <Field label="Business / trading name">
        <Input value={name} onChange={setName} placeholder="e.g. Thabo's Plumbing" />
      </Field>

      <Field label="What kind of business is it?">
        <Chips
          options={BUSINESS_TYPES.map((t) => t.label)}
          selected={BUSINESS_TYPES.find((t) => t.id === businessType)?.label ?? ""}
          onSelect={(label) => setBusinessType(BUSINESS_TYPES.find((t) => t.label === label)?.id ?? "")}
        />
      </Field>

      <Field label="Tools on your home screen">
        <button
          type="button"
          onClick={() => setShowAllTools((p) => !p)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "12px 14px",
            borderRadius: 12,
            border: `1.5px solid ${showAllTools ? "#0C4A6E" : "#e2e8f0"}`,
            background: showAllTools ? "#F0F9FF" : "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18 }}>{showAllTools ? "✅" : "⬜"}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: showAllTools ? "#0C4A6E" : "#111" }}>Show every tool</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              Turn this on to see everything WORKLOG can do, whatever your business type
            </div>
          </div>
        </button>

        <div style={{ marginTop: 8, padding: "9px 12px", background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 10, fontSize: 11, color: "#0C4A6E", lineHeight: 1.6 }}>
          {/* Deliberately no count: the core list counts tools, but the home
              screen draws tiles — Contacts is one tile for two tools, and the
              tax tools sit inside the Tax & SARS hub. A number here wouldn't
              match what the owner counts on screen. */}
          {preview === null
            ? "Your home screen will show every tool your plan and permissions allow."
            : "Your home screen will show the tools this kind of business usually needs. The rest stay switched on — nothing is locked or deleted, and none of your records are affected."}
        </div>
      </Field>

      <Field label="Address">
        <Input value={address} onChange={setAddress} placeholder="Street, suburb, city" />
      </Field>
      <Field label="Phone">
        <Input value={phone} onChange={setPhone} placeholder="082 123 4567" type="tel" />
      </Field>
      <Field label="Email">
        <Input value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
      </Field>

      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, margin: "18px 0 10px" }}>
        How customers pay you
      </div>
      <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
        These print on your invoices and quotes so a customer knows where to send the money. Fill in at least the bank and
        account number, or the block is left off.
      </div>

      <Field label="Bank">
        <Input value={bankName} onChange={setBankName} placeholder="e.g. FNB, Capitec, Standard Bank" />
      </Field>
      <Field label="Account number">
        <Input value={bankAccount} onChange={setBankAccount} placeholder="Your business account number" />
      </Field>
      <Field label="Branch code (optional)">
        <Input value={bankBranch} onChange={setBankBranch} placeholder="e.g. 250655" />
      </Field>
      <Field label="Payment reference (optional)">
        <Input value={bankRef} onChange={setBankRef} placeholder="e.g. your trading name" />
        <p style={{ fontSize: 11, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
          {bankRef.trim()
            ? `Customers will be asked to use "${bankRef.trim()} / INV-2026-0001" so you can match the payment.`
            : "Leave blank and the document number alone is used as the reference."}
        </p>
      </Field>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn
        label={updateProfile.isPending ? "Saving..." : "Save details"}
        icon="💾"
        onClick={handleSave}
        disabled={updateProfile.isPending}
      />
    </Modal>
  );
}
