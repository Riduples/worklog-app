"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { useCreateContact, useUpdateContact, type Contact } from "@/lib/supabase/hooks/useContacts";

const PAYMENT_BEHAVIOURS = ["Good payer", "Slow payer", "Problem payer"];
const PAYMENT_TERMS = ["On delivery", "7 days", "30 days", "60 days", "Cash only", "Pre-payment"];

// Per-type look & copy — customers read blue, suppliers amber — so the whole
// form matches the worklog v126 design.
const THEME = {
  client: {
    icon: "👤",
    noun: "Customer",
    plural: "Customers",
    bg: "#F0F9FF",
    border: "#BAE6FD",
    text: "#0369A1",
    intro: "People or businesses that buy from you. Save them here so you can quickly pick them when creating quotes, invoices, and statements, and track their payment behaviour.",
    namePlaceholder: "e.g. Sipho Dlamini, ABC Pty Ltd...",
    phonePlaceholder: "e.g. 082 123 4567",
    emailPlaceholder: "e.g. name@email.com",
    addressPlaceholder: "e.g. 12 Main St, Johannesburg",
    notesPlaceholder: "Anything useful — account code, preferences, special requirements",
  },
  supplier: {
    icon: "🏬",
    noun: "Supplier",
    plural: "Suppliers",
    bg: "#fff7ed",
    border: "#fed7aa",
    text: "#b45309",
    intro: "Businesses or people you buy from. Save them here so you can quickly pick them when creating purchase orders and supplier invoices, and track their payment terms.",
    namePlaceholder: "e.g. Builders Warehouse, John's Hardware...",
    phonePlaceholder: "e.g. 011 123 4567",
    emailPlaceholder: "e.g. orders@supplier.com",
    addressPlaceholder: "e.g. Cnr Eloff & Commissioner, JHB",
    notesPlaceholder: "Anything useful about this supplier...",
  },
} as const;

export function ContactModal({
  contact,
  defaultType = "client",
  lockType = false,
  onImport,
  onClose,
}: {
  contact?: Contact;
  defaultType?: "client" | "supplier";
  /** Opened from a type-locked screen (Customers/Suppliers) — hide the toggle. */
  lockType?: boolean;
  /** Show the "Import from CSV" banner and run this when tapped. */
  onImport?: () => void;
  onClose: () => void;
}) {
  const isEdit = !!contact;
  const [contactType, setContactType] = useState<"client" | "supplier">(
    (contact?.contact_type as "client" | "supplier") || defaultType
  );
  const [name, setName] = useState(contact?.name ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [address, setAddress] = useState(contact?.address ?? "");
  const [customLabel, setCustomLabel] = useState(contact?.custom_label ?? "");
  const [customValue, setCustomValue] = useState(contact?.custom_value ?? "");
  const [paymentBehaviour, setPaymentBehaviour] = useState(contact?.payment_behaviour ?? "Good payer");
  const [paymentTerms, setPaymentTerms] = useState(contact?.payment_terms ?? "On delivery");
  const [bankName, setBankName] = useState(contact?.bank_name ?? "");
  const [accountNumber, setAccountNumber] = useState(contact?.account_number ?? "");
  const [error, setError] = useState("");

  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const saving = createContact.isPending || updateContact.isPending;

  const isClient = contactType === "client";
  const t = THEME[contactType];

  const handleSave = () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setError("");

    const changes = {
      contact_type: contactType,
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      custom_label: isClient ? customLabel.trim() || null : null,
      custom_value: isClient ? customValue.trim() || null : null,
      notes: notes.trim() || null,
      payment_behaviour: isClient ? paymentBehaviour : null,
      payment_terms: isClient ? null : paymentTerms,
      bank_name: isClient ? null : bankName.trim() || null,
      account_number: isClient ? null : accountNumber.trim() || null,
    };

    if (isEdit) {
      updateContact.mutate({ id: contact.id, changes }, { onSuccess: onClose });
    } else {
      createContact.mutate(changes, { onSuccess: onClose });
    }
  };

  return (
    <Modal title={isEdit ? `Edit ${t.noun.toLowerCase()}` : t.plural} onClose={onClose}>
      {!lockType && (
        <Field label="Type">
          <Chips options={["client", "supplier"]} selected={contactType} onSelect={(v) => v && setContactType(v as "client" | "supplier")} />
        </Field>
      )}

      <div style={{ background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16, fontSize: 13.5, color: t.text, lineHeight: 1.5 }}>
        {t.icon} <strong>{t.plural}</strong> — {t.intro}
      </div>

      {!isEdit && lockType && onImport && (
        <button
          type="button"
          onClick={onImport}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            width: "100%",
            background: t.bg,
            border: `1.5px solid ${t.border}`,
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 20,
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>📁 Import {isClient ? "customers" : "suppliers"} from CSV</span>
          <span style={{ fontSize: 13, color: "#64748b" }}>bulk upload</span>
        </button>
      )}

      <Field label={`${t.noun} / company name`}>
        <Input value={name} onChange={setName} placeholder={t.namePlaceholder} autoFocus />
      </Field>
      <Field label="Phone">
        <Input value={phone ?? ""} onChange={setPhone} placeholder={t.phonePlaceholder} type="tel" />
      </Field>
      <Field label="Email">
        <Input value={email ?? ""} onChange={setEmail} placeholder={t.emailPlaceholder} type="email" />
      </Field>
      <Field label="Address (optional)">
        <Input value={address ?? ""} onChange={setAddress} placeholder={t.addressPlaceholder} />
      </Field>

      {isClient ? (
        <>
          <Field label="Payment behaviour">
            <Chips options={PAYMENT_BEHAVIOURS} selected={paymentBehaviour ?? ""} onSelect={setPaymentBehaviour} />
          </Field>
          <Field label="Notes (optional)">
            <Textarea value={notes ?? ""} onChange={setNotes} placeholder={t.notesPlaceholder} rows={2} />
          </Field>
          <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 10 }}>✏️ Custom field — add anything unique to your business</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Label (e.g. pet name, vehicle, account)">
                <Input value={customLabel ?? ""} onChange={setCustomLabel} placeholder="e.g. Pet name" />
              </Field>
              <Field label="Value">
                <Input value={customValue ?? ""} onChange={setCustomValue} placeholder="e.g. Biscuit" />
              </Field>
            </div>
          </div>
        </>
      ) : (
        <>
          <Field label="Payment terms">
            <Chips options={PAYMENT_TERMS} selected={paymentTerms ?? ""} onSelect={setPaymentTerms} />
          </Field>
          <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 12.5, color: "#92400e", lineHeight: 1.5 }}>
            🔒 <strong>Banking details (optional):</strong> Handy for paying this supplier. Keep them secure and only store them with the supplier&apos;s agreement.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Bank">
              <Input value={bankName ?? ""} onChange={setBankName} placeholder="e.g. FNB" />
            </Field>
            <Field label="Account number">
              <Input value={accountNumber ?? ""} onChange={setAccountNumber} placeholder="Account no." />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <Textarea value={notes ?? ""} onChange={setNotes} placeholder={t.notesPlaceholder} rows={2} />
          </Field>
        </>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : `Save ${t.noun}`} icon={t.icon} onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
