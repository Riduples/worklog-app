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
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { usePurchaseOrders } from "@/lib/supabase/hooks/usePurchaseOrders";
import { useCreateSupplierInvoice } from "@/lib/supabase/hooks/useSupplierInvoices";

export function SupplierInvoiceModal({ onClose }: { onClose: () => void }) {
  const [supplier, setSupplier] = useState("");
  const [supplierContactId, setSupplierContactId] = useState<string | null>(null);
  const [refNumber, setRefNumber] = useState("");
  const [issueDate, setIssueDate] = useState(todayStr());
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<PurchaseLineItem[]>([{ desc: "", qty: 1, unit_price: 0 }]);
  const [paidAmount, setPaidAmount] = useState("0");
  const [linkedPoId, setLinkedPoId] = useState<string | null>(null);
  const [showPoPicker, setShowPoPicker] = useState(false);
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const { data: business } = useBusinessProfile();
  const { data: purchaseOrders } = usePurchaseOrders();
  const { VAT_RATE } = useTaxRates();
  const createSI = useCreateSupplierInvoice();

  const suppliers = (contacts ?? []).filter((c) => c.contact_type === "supplier");
  const openPos = (purchaseOrders ?? []).filter((po) => po.status !== "cancelled");
  const linkedPo = openPos.find((po) => po.id === linkedPoId);

  const subtotal = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.unit_price || 0), 0);
  const isVatRegistered = !!business?.vat_number;
  const vatAmount = isVatRegistered ? subtotal * VAT_RATE : 0;
  const paidNum = parseFloat(paidAmount) || 0;
  const balanceDue = subtotal - paidNum;

  const loadFromPo = (poId: string) => {
    const po = openPos.find((p) => p.id === poId);
    if (!po) return;
    setLinkedPoId(po.id);
    setSupplier(po.supplier_name);
    setSupplierContactId(po.supplier_contact_id);
    setItems((po.line_items as PurchaseLineItem[]) ?? []);
    setShowPoPicker(false);
  };

  const handleSave = () => {
    if (!supplier.trim()) {
      setError("Supplier is required.");
      return;
    }
    setError("");

    createSI.mutate(
      {
        supplier_contact_id: supplierContactId,
        supplier_name: supplier.trim(),
        supplier_ref_number: refNumber.trim() || null,
        line_items: items.filter((it) => it.desc || it.unit_price),
        invoice_amount: subtotal,
        paid_amount: paidNum,
        balance_due: balanceDue,
        issue_date: issueDate,
        due_date: dueDate || null,
        status: balanceDue <= 0 ? "paid" : "unpaid",
        paid_date: balanceDue <= 0 ? todayStr() : null,
        linked_po_id: linkedPoId,
        vat_rate: isVatRegistered ? VAT_RATE : null,
        vat_amount: vatAmount,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal title="New supplier invoice" onClose={onClose}>
      {openPos.length > 0 && (
        <div style={{ marginBottom: 16, position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowPoPicker((p) => !p)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: `1.5px solid ${linkedPo ? "#0C4A6E" : "#fed7aa"}`,
              background: linkedPo ? "#F0F9FF" : "#fffbeb",
              cursor: "pointer",
              textAlign: "left",
              fontSize: 13,
              fontWeight: 600,
              color: linkedPo ? "#0C4A6E" : "#92400e",
            }}
          >
            {linkedPo ? `🛒 Linked to ${linkedPo.doc_number} — ${linkedPo.supplier_name}` : "🛒 Link to a purchase order (optional) — tap to pick"}
          </button>
          {showPoPicker && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 60,
                background: "#fff",
                border: "1.5px solid #BAE6FD",
                borderRadius: 12,
                marginTop: 4,
                boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                overflow: "hidden",
                maxHeight: 240,
                overflowY: "auto",
              }}
            >
              {linkedPoId && (
                <button
                  type="button"
                  onClick={() => {
                    setLinkedPoId(null);
                    setShowPoPicker(false);
                  }}
                  style={{ width: "100%", padding: "10px 14px", border: "none", borderBottom: "1px solid #f8fafc", background: "#fff7ed", cursor: "pointer", textAlign: "left", fontSize: 13, color: "#b45309", fontWeight: 600 }}
                >
                  ✕ Remove link
                </button>
              )}
              {openPos.map((po) => (
                <button
                  key={po.id}
                  type="button"
                  onClick={() => loadFromPo(po.id)}
                  style={{ width: "100%", padding: "11px 14px", border: "none", borderBottom: "1px solid #f8fafc", background: "#fff", cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
                    {po.doc_number} — {po.supplier_name}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {po.issue_date} · {fmt(po.total_amount)} · {po.status}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <ContactPicker
        label="Supplier"
        value={supplier}
        onChange={(v, id) => {
          setSupplier(v);
          setSupplierContactId(id);
        }}
        contacts={suppliers}
        placeholder="Supplier name"
      />

      <Field label="Supplier's invoice number (optional)">
        <Input value={refNumber} onChange={setRefNumber} placeholder="Their reference" />
      </Field>

      <Field label="Invoice date">
        <Input value={issueDate} onChange={setIssueDate} type="date" />
      </Field>

      <Field label="Due date (optional)">
        <Input value={dueDate} onChange={setDueDate} type="date" />
      </Field>

      <PurchaseLineItemsEditor items={items} onChange={setItems} />

      <Field label="Already paid">
        <Input value={paidAmount} onChange={setPaidAmount} type="number" placeholder="0.00" />
      </Field>

      <div style={{ background: "#fff7ed", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal{isVatRegistered ? " (excl. VAT)" : ""}</span>
          <span>{fmt(subtotal)}</span>
        </div>
        {isVatRegistered && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Input VAT ({(VAT_RATE * 100).toFixed(0)}%) — claimable</span>
            <span>{fmt(vatAmount)}</span>
          </div>
        )}
        {paidNum > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Already paid</span>
            <span>−{fmt(paidNum)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, marginTop: 6, paddingTop: 6, borderTop: "1.5px solid #fed7aa" }}>
          <span>Balance you owe{isVatRegistered ? " (incl. VAT)" : ""}</span>
          <span>{fmt(balanceDue + vatAmount)}</span>
        </div>
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={createSI.isPending ? "Saving..." : "Save supplier invoice"} onClick={handleSave} disabled={createSI.isPending} />
    </Modal>
  );
}
