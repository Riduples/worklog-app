"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { LineCategoryPicker } from "@/components/ui/LineCategoryPicker";
import { useCreateContact, useUpdateContact, type Contact } from "@/lib/supabase/hooks/useContacts";

const PAYMENT_BEHAVIOURS = ["Good payer", "Slow payer", "Problem payer"];
const PAYMENT_TERMS = ["On delivery", "7 days", "30 days", "60 days", "Cash only", "Pre-payment"];

// Per-type copy — the label, icon and placeholders switch between customers and
// suppliers so the form reads right for whichever one you're adding.
const THEME = {
  client: {
    icon: "👤",
    noun: "Customer",
    plural: "Customers",
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
    namePlaceholder: "e.g. Builders Warehouse, John's Hardware...",
    phonePlaceholder: "e.g. 011 123 4567",
    emailPlaceholder: "e.g. orders@supplier.com",
    addressPlaceholder: "e.g. Cnr Eloff & Commissioner, JHB",
    notesPlaceholder: "Anything useful — account code, preferences, special requirements",
  },
} as const;

export function ContactModal({
  contact,
  defaultType = "client",
  lockType = false,
  onClose,
}: {
  contact?: Contact;
  defaultType?: "client" | "supplier";
  /** Opened from a type-locked screen (Customers/Suppliers) — hide the toggle. */
  lockType?: boolean;
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
  const [defaultCategory, setDefaultCategory] = useState<string | null>(contact?.default_sars_category ?? null);
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
      default_sars_category: defaultCategory,
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
          <div style={{ display: "flex", gap: 8 }}>
            {(["client", "supplier"] as const).map((t) => {
              const active = contactType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setContactType(t);
                    // The two types read different category lists, so a value
                    // picked before the switch belongs to the wrong one.
                    setDefaultCategory(null);
                  }}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 20,
                    border: `1.5px solid ${active ? "#0C4A6E" : "#e2e8f0"}`,
                    background: active ? "#0C4A6E" : "#fff",
                    color: active ? "#fff" : "#374151",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {t === "client" ? "Customer" : "Supplier"}
                </button>
              );
            })}
          </div>
        </Field>
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
      <Field label="Address - optional">
        <Input value={address ?? ""} onChange={setAddress} placeholder={t.addressPlaceholder} />
      </Field>

      {isClient ? (
        <>
          <Field label="Payment behaviour">
            <Chips options={PAYMENT_BEHAVIOURS} selected={paymentBehaviour ?? ""} onSelect={setPaymentBehaviour} />
          </Field>
          <Field label="Notes - optional">
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
          <Field label="Notes - optional">
            <Textarea value={notes ?? ""} onChange={setNotes} placeholder={t.notesPlaceholder} rows={2} />
          </Field>
          <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 12.5, color: "#92400e", lineHeight: 1.5 }}>
            🔒 <strong>Banking details - optional:</strong> Handy for paying this supplier. Banking details are sensitive personal data under POPIA — keep them secure and only store them with the supplier&apos;s agreement.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Bank">
              <Input value={bankName ?? ""} onChange={setBankName} placeholder="e.g. FNB" />
            </Field>
            <Field label="Account number">
              <Input value={accountNumber ?? ""} onChange={setAccountNumber} placeholder="Account no." />
            </Field>
          </div>
        </>
      )}

      {/* Most of a small business's trade is a few dozen repeat names, and the same
          name almost always files under the same category. Set once here and every
          document line raised against this contact starts out already filed — a
          customer searches income headings only, a supplier expense headings only,
          so neither can be given the other's. Remounted per type, because a value
          picked before the toggle flipped belongs to the wrong list.

          Not enforced. Leaving it blank costs nothing today and the reports still
          add up, so blocking the save would be a lie about the stakes; it only
          means the lines file under Uncategorised until someone says otherwise.
          The warning below says exactly that, and the contact saves either way —
          which is also what an older contact that predates this field gets. */}
      <div style={{ marginBottom: 16 }}>
        <LineCategoryPicker
          key={contactType}
          kind={isClient ? "income" : "expense"}
          value={defaultCategory}
          onChange={setDefaultCategory}
          warnWhenEmpty
        />
        {!defaultCategory && (
          <p style={{ fontSize: 11.5, color: "#b45309", margin: "6px 0 0", lineHeight: 1.5 }}>
            You can save without this. Until it is set, lines on{" "}
            {isClient ? "invoices and quotes for this customer" : "bills and orders from this supplier"} start with
            no category and show under &ldquo;Uncategorised&rdquo; on your Profit &amp; Loss — you can still pick one
            on each line as you go.
          </p>
        )}
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : `Save ${t.noun}`} icon={t.icon} onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
