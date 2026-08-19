"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { ContactPicker } from "@/components/ui/ContactPicker";
import { PurchaseLineItemsEditor, type PurchaseLineItem } from "@/components/ui/PurchaseLineItemsEditor";
import { fmt, todayStr } from "@/lib/format";
import { useTaxRates } from "@/lib/taxRates";
import { getNextDocNumber } from "@/lib/docNumber";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useCreatePurchaseOrder, useUpdatePurchaseOrder, type PurchaseOrder } from "@/lib/supabase/hooks/usePurchaseOrders";
import { createClient } from "@/lib/supabase/client";

export function PurchaseOrderModal({ po, onClose }: { po?: PurchaseOrder; onClose: () => void }) {
  const isEdit = !!po;
  const existingItems = po?.line_items as PurchaseLineItem[] | undefined;
  const [supplier, setSupplier] = useState(po?.supplier_name ?? "");
  const [supplierContactId, setSupplierContactId] = useState<string | null>(po?.supplier_contact_id ?? null);
  const [issueDate, setIssueDate] = useState(po?.issue_date ?? todayStr());
  const [requestedDelivery, setRequestedDelivery] = useState(po?.requested_delivery ?? "");
  const [items, setItems] = useState<PurchaseLineItem[]>(existingItems && existingItems.length ? existingItems : []);
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const { data: business } = useBusinessProfile();
  const { VAT_RATE } = useTaxRates();
  const createPO = useCreatePurchaseOrder();
  const updatePO = useUpdatePurchaseOrder();
  const saving = createPO.isPending || updatePO.isPending;

  const suppliers = (contacts ?? []).filter((c) => c.contact_type === "supplier");
  // The supplier's usual heading seeds each new line, so the common bill needs no
  // category typed at all — and any line stays overridable for the bill that mixes
  // cleaning with stationery.
  const supplierDefaultCategory =
    suppliers.find((c) => c.id === supplierContactId)?.default_sars_category ?? null;
  const subtotal = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.unit_price || 0), 0);
  const isVatRegistered = !!business?.vat_number;
  const vatAmount = isVatRegistered ? subtotal * VAT_RATE : 0;

  const handleSave = async () => {
    if (!supplier.trim()) {
      setError("Supplier is required.");
      return;
    }
    if (!items.some((it) => it.desc || it.unit_price)) {
      setError("Add at least one line item.");
      return;
    }
    if (!business) return;
    setError("");

    const changes = {
      supplier_contact_id: supplierContactId,
      supplier_name: supplier.trim(),
      line_items: items.filter((it) => it.desc || it.unit_price),
      total_amount: subtotal,
      issue_date: issueDate,
      requested_delivery: requestedDelivery || null,
      vat_rate: isVatRegistered ? VAT_RATE : null,
      vat_amount: vatAmount,
    };

    if (isEdit) {
      // Keep the existing doc_number & status — only the contents change.
      updatePO.mutate({ id: po.id, changes }, { onSuccess: onClose });
      return;
    }

    const supabase = createClient();
    const docNumber = await getNextDocNumber(supabase, business.id, "PO");

    createPO.mutate(
      { ...changes, doc_number: docNumber, status: "pending" },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal title={isEdit ? "Edit purchase order" : "New purchase order"} onClose={onClose}>
      <ContactPicker
        label="Supplier"
        value={supplier}
        onChange={(v, id) => {
          setSupplier(v);
          setSupplierContactId(id);
        }}
        contacts={suppliers}
        placeholder="Type name or pick from your suppliers"
      />

      <Field label="Issue date">
        <Input value={issueDate} onChange={setIssueDate} type="date" />
      </Field>

      <Field label="Requested delivery date - optional">
        <Input value={requestedDelivery} onChange={setRequestedDelivery} type="date" />
      </Field>

      <PurchaseLineItemsEditor
        items={items}
        onChange={setItems}
        defaultCategory={supplierDefaultCategory}
        defaultCategorySource="this supplier"
      />

      <div style={{ background: "#fff7ed", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal{isVatRegistered ? " (excl. VAT)" : ""}</span>
          <span>{fmt(subtotal)}</span>
        </div>
        {isVatRegistered && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>VAT ({(VAT_RATE * 100).toFixed(0)}%)</span>
            <span>{fmt(vatAmount)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, marginTop: 6, paddingTop: 6, borderTop: "1.5px solid #fed7aa" }}>
          <span>PO total{isVatRegistered ? " (incl. VAT)" : ""}</span>
          <span>{fmt(subtotal + vatAmount)}</span>
        </div>
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : "Save purchase order"} onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
