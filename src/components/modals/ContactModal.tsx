"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { useCreateContact, useUpdateContact, type Contact } from "@/lib/supabase/hooks/useContacts";

const PAYMENT_BEHAVIOURS = ["Good payer", "Slow payer", "Problem payer"];
const PAYMENT_TERMS = ["On delivery", "7 days", "30 days", "60 days", "Cash only", "Pre-payment"];

export function ContactModal({
  contact,
  defaultType = "client",
  onClose,
}: {
  contact?: Contact;
  defaultType?: "client" | "supplier";
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
  const [paymentBehaviour, setPaymentBehaviour] = useState(contact?.payment_behaviour ?? "Good payer");
  const [paymentTerms, setPaymentTerms] = useState(contact?.payment_terms ?? "On delivery");
  const [error, setError] = useState("");

  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const saving = createContact.isPending || updateContact.isPending;

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
      notes: notes.trim() || null,
      payment_behaviour: contactType === "client" ? paymentBehaviour : null,
      payment_terms: contactType === "supplier" ? paymentTerms : null,
    };

    if (isEdit) {
      updateContact.mutate({ id: contact.id, changes }, { onSuccess: onClose });
    } else {
      createContact.mutate(changes, { onSuccess: onClose });
    }
  };

  return (
    <Modal title={isEdit ? "Edit contact" : "Add contact"} onClose={onClose}>
      <Field label="Type">
        <Chips
          options={["client", "supplier"]}
          selected={contactType}
          onSelect={(v) => v && setContactType(v as "client" | "supplier")}
        />
      </Field>
      <Field label="Name">
        <Input value={name} onChange={setName} placeholder="Full name or business name" autoFocus />
      </Field>
      <Field label="Phone">
        <Input value={phone ?? ""} onChange={setPhone} placeholder="082 123 4567" type="tel" />
      </Field>
      <Field label="Email">
        <Input value={email ?? ""} onChange={setEmail} placeholder="name@example.com" type="email" />
      </Field>
      {contactType === "client" ? (
        <Field label="Payment behaviour">
          <Chips options={PAYMENT_BEHAVIOURS} selected={paymentBehaviour ?? ""} onSelect={setPaymentBehaviour} />
        </Field>
      ) : (
        <Field label="Payment terms">
          <Chips options={PAYMENT_TERMS} selected={paymentTerms ?? ""} onSelect={setPaymentTerms} />
        </Field>
      )}
      <Field label="Notes">
        <Input value={notes ?? ""} onChange={setNotes} placeholder="Optional" />
      </Field>
      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : "Save contact"} onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
