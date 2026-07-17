"use client";

import { useState } from "react";
import { useSupplierInvoices } from "@/lib/supabase/hooks/useSupplierInvoices";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";
import { buildRemittanceHTML, type RemittanceLine } from "@/lib/docgen/buildLedgerHTML";
import { openDocumentForPrinting, shareDocumentText } from "@/lib/docgen/shareDocument";
import { renderPdf, downloadBlob } from "@/lib/docgen/renderPdf";
import { fmt, todayStr } from "@/lib/format";
import { balanceInclVat } from "@/lib/balance";
import { BackLink } from "@/components/ui/BackLink";

export function RemittanceView() {
  const { data: supplierInvoices } = useSupplierInvoices();
  const { data: contacts } = useContacts();
  const { data: business } = useBusinessProfile();

  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("EFT / Bank transfer");
  const [paymentDate, setPaymentDate] = useState(todayStr());
  const [paymentRef, setPaymentRef] = useState("");
  const [busy, setBusy] = useState(false);

  const supplierNames = [
    ...new Set([
      ...(contacts ?? []).filter((c) => c.contact_type === "supplier").map((c) => c.name),
      ...(supplierInvoices ?? []).map((si) => si.supplier_name),
    ]),
  ]
    .filter(Boolean)
    .sort();

  const balanceOf = (si: { balance_due: number; vat_amount: number | null }) => balanceInclVat(si.balance_due, si.vat_amount);

  const supplierSIs = (supplierInvoices ?? []).filter((si) => si.supplier_name === selectedSupplier && si.status !== "paid");
  const selectedSIs = supplierSIs.filter((si) => selectedIds.includes(si.id));
  const totalSelected = selectedSIs.reduce((s, si) => s + balanceOf(si), 0);
  const paymentTotal = paymentAmount !== "" ? parseFloat(paymentAmount) : totalSelected;

  const owedFor = (name: string) =>
    (supplierInvoices ?? [])
      .filter((si) => si.supplier_name === name && si.status !== "paid")
      .reduce((s, si) => s + balanceOf(si), 0);

  const toggle = (id: string) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const lines = (): RemittanceLine[] =>
    selectedSIs.map((si) => ({
      date: si.issue_date,
      reference: si.supplier_ref_number || "—",
      invoiceAmount: Number(si.invoice_amount) + Number(si.vat_amount ?? 0),
      amountPaying: balanceOf(si),
    }));

  const handlePrint = async () => {
    if (!business || busy) return;
    setBusy(true);
    const payment = { method: paymentMethod, date: paymentDate, reference: paymentRef.trim(), total: paymentTotal };
    const filename = `remittance-${selectedSupplier.replace(/\s+/g, "-")}`;
    try {
      const blob = await renderPdf({ kind: "remittance", supplierName: selectedSupplier, lines: lines(), payment });
      downloadBlob(blob, filename);
    } catch {
      // Fall back to the print flow rather than leaving the user stuck.
      openDocumentForPrinting(buildRemittanceHTML(business, selectedSupplier, lines(), payment), filename);
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    const text = [
      `REMITTANCE ADVICE`,
      `From: ${business?.name || "Your Business"}`,
      `To: ${selectedSupplier}`,
      `Date: ${paymentDate}`,
      `Method: ${paymentMethod}${paymentRef.trim() ? ` (Ref: ${paymentRef.trim()})` : ""}`,
      ``,
      `Invoices being settled:`,
      ...selectedSIs.map((si) => `  ${si.supplier_ref_number || "Invoice"} — ${fmt(balanceOf(si))}`),
      ``,
      `Total payment: ${fmt(paymentTotal)}`,
      ``,
      `Generated via Worklog`,
    ].join("\n");
    await shareDocumentText(`Remittance — ${selectedSupplier}`, text);
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <BackLink />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>Remittance Advice</h1>

      <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", marginBottom: 18, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
        A remittance advice tells your supplier exactly which of their invoices your payment covers. Send it when you make a payment so there&apos;s no confusion on their side.
      </div>

      <Field label="Select supplier">
        <div style={{ position: "relative" }}>
          <Input
            value={selectedSupplier}
            onChange={(v) => {
              setSelectedSupplier(v);
              setSelectedIds([]);
            }}
            placeholder="Type name or tap List..."
          />
          {supplierNames.length > 0 && (
            <button
              onClick={() => setShowPicker((p) => !p)}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "#b45309", border: "none", borderRadius: 8, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              {showPicker ? "✕" : "🏪 List"}
            </button>
          )}
        </div>
        {showPicker && (
          <div style={{ background: "#fff", border: "1.5px solid #fed7aa", borderRadius: 12, marginTop: 6, overflow: "hidden", maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            {supplierNames.map((n) => {
              const owed = owedFor(n);
              return (
                <button
                  key={n}
                  onClick={() => {
                    setSelectedSupplier(n);
                    setSelectedIds([]);
                    setShowPicker(false);
                  }}
                  style={{ width: "100%", padding: "11px 14px", border: "none", borderBottom: "1px solid #fff7ed", background: "#fff", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{n}</span>
                  {owed > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#b45309", background: "#fff7ed", padding: "3px 8px", borderRadius: 10 }}>{fmt(owed)} owed</span>}
                </button>
              );
            })}
          </div>
        )}
      </Field>

      {selectedSupplier && supplierSIs.length === 0 && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: "14px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          No unpaid invoices for {selectedSupplier}
        </div>
      )}

      {selectedSupplier && supplierSIs.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
            Select invoices you are paying
          </div>
          {supplierSIs.map((si) => {
            const on = selectedIds.includes(si.id);
            return (
              <button
                key={si.id}
                onClick={() => toggle(si.id)}
                style={{ width: "100%", background: on ? "#fff7ed" : "#f8fafc", border: `1.5px solid ${on ? "#b45309" : "#e2e8f0"}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{si.supplier_ref_number || "Invoice"}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {si.issue_date}
                    {si.due_date ? ` · Due ${si.due_date}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#b45309" }}>{fmt(balanceOf(si))}</div>
                  <span style={{ fontSize: 16, color: on ? "#b45309" : "#cbd5e1" }}>{on ? "☑" : "☐"}</span>
                </div>
              </button>
            );
          })}

          {selectedIds.length > 0 && (
            <>
              <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "12px 16px", margin: "6px 0 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#38BDF8", fontWeight: 700 }}>
                  {selectedIds.length} invoice{selectedIds.length !== 1 ? "s" : ""} selected
                </span>
                <span style={{ fontSize: 20, color: "#fff", fontWeight: 900 }}>{fmt(totalSelected)}</span>
              </div>

              <Field label="Payment amount (leave blank to pay the full selected total)">
                <Input type="number" value={paymentAmount} onChange={setPaymentAmount} placeholder={totalSelected.toFixed(2)} />
              </Field>
              <PaymentMethodPicker selected={paymentMethod} onSelect={setPaymentMethod} />
              <Field label="Payment date">
                <Input type="date" value={paymentDate} onChange={setPaymentDate} />
              </Field>
              <Field label="Payment reference (optional)">
                <Input value={paymentRef} onChange={setPaymentRef} placeholder="e.g. EFT reference the supplier will see" />
              </Field>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  onClick={handlePrint}
                  disabled={!business || busy}
                  style={{ flex: 1, background: "#F0F9FF", color: "#0C4A6E", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  {busy ? "📄 Preparing..." : "📄 Download PDF"}
                </button>
                <button
                  onClick={handleShare}
                  style={{ flex: 1, background: "#F0F9FF", color: "#0C4A6E", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  📤 Share
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
