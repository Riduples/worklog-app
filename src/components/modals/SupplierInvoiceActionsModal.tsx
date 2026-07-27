"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Row } from "@/components/ui/Row";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { fmt, todayStr } from "@/lib/format";
import { balanceInclVat } from "@/lib/balance";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { useUpdateSupplierInvoice, type SupplierInvoice } from "@/lib/supabase/hooks/useSupplierInvoices";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTaxRates } from "@/lib/taxRates";
import { useCreditNotes, useCreateCreditNote } from "@/lib/supabase/hooks/useCreditNotes";
import { createClient } from "@/lib/supabase/client";
import { getNextDocNumber } from "@/lib/docNumber";
import {
  round2,
  creditVatWithin,
  initialOnAccount,
  initialStatus,
  creditedAgainstSupplierInvoice,
} from "@/lib/creditNotes";
import type { PurchaseLineItem } from "@/components/ui/PurchaseLineItemsEditor";

export function supplierInvoiceDisplayStatus(si: SupplierInvoice): { label: string; bg: string; fg: string } {
  if (si.status === "credited") return { label: "credited", bg: "#f5f3ff", fg: "#6d28d9" };
  if (si.status === "paid") return { label: "paid", bg: "#F0F9FF", fg: "#0369A1" };
  const isOverdue = !!si.due_date && si.due_date < todayStr();
  if (isOverdue) return { label: "overdue", bg: "#fee2e2", fg: "#991b1b" };
  return { label: "unpaid", bg: "#fff7ed", fg: "#b45309" };
}

export function SupplierInvoiceActionsModal({ si, onClose }: { si: SupplierInvoice; onClose: () => void }) {
  const updateSI = useUpdateSupplierInvoice();
  const access = useToolAccess("supplierinvoice");
  const { data: business } = useBusinessProfile();
  const { VAT_RATE } = useTaxRates();
  const creditNotes = useCreditNotes().data ?? [];
  const createCN = useCreateCreditNote();
  const supabase = createClient();
  const hasVat = !!business?.vat_number;

  const items = (si.line_items as PurchaseLineItem[]) ?? [];
  const status = supplierInvoiceDisplayStatus(si);
  const totalInclVat = Number(si.invoice_amount) + Number(si.vat_amount ?? 0);
  // Marking paid (below) zeroes balance_due and leaves vat_amount, so the naive
  // sum told you a settled invoice still owed the supplier exactly the VAT.
  // Its sales-side sibling has had the guard since 3885cf2; this side didn't.
  const balanceOwed = balanceInclVat(si.balance_due, si.vat_amount);

  // ── "Supplier credited me" state ──
  const [showCredit, setShowCredit] = useState(false);
  const [scope, setScope] = useState<"whole" | "lines">("whole");
  const [selected, setSelected] = useState<boolean[]>(() => items.map(() => false));
  const [reason, setReason] = useState("");
  const [chosenSettlement, setChosenSettlement] = useState<"reduce" | "account">("reduce");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const balanceOwing = si.status === "paid" ? 0 : Number(si.balance_due) > 0 ? Number(si.balance_due) + Number(si.vat_amount ?? 0) : 0;
  const isPaid = si.status === "paid" || balanceOwing <= 0;
  const exVatChosen =
    scope === "whole"
      ? Number(si.invoice_amount)
      : items.reduce((s, it, i) => s + (selected[i] ? Number(it.qty || 0) * Number(it.unit_price || 0) : 0), 0);
  const creditAmt = hasVat ? round2(exVatChosen * (1 + VAT_RATE)) : round2(exVatChosen);
  const creditVat = creditVatWithin(creditAmt, VAT_RATE, hasVat);
  const alreadyCredited = creditedAgainstSupplierInvoice(creditNotes, si.id);
  const creditable = round2(totalInclVat - alreadyCredited);

  const noLines = scope === "lines" && !selected.some(Boolean);
  const overCredit = creditAmt > creditable + 0.001;
  const canCreate = !!business && !busy && !createCN.isPending && creditAmt > 0 && !noLines && !overCredit;

  async function handleCreateCredit() {
    if (!business || !canCreate) return;
    setBusy(true);
    setError("");
    try {
      const settlement = isPaid ? "account" : chosenSettlement;
      const onAcct = initialOnAccount(creditAmt, balanceOwing, settlement);
      await createCN.mutateAsync({
        doc_number: await getNextDocNumber(supabase, business.id, "CN"),
        ledger: "supplier",
        invoice_id: null,
        supplier_invoice_id: si.id,
        original_doc_number: si.supplier_ref_number ?? null,
        contact_id: si.supplier_contact_id,
        contact_name: si.supplier_name,
        amount: creditAmt,
        vat_rate: hasVat ? VAT_RATE : null,
        vat_amount: creditVat,
        scope,
        line_items: scope === "lines" ? items.filter((_, i) => selected[i]) : items,
        reason: reason.trim() || null,
        settlement,
        on_account_balance: onAcct,
        status: initialStatus(onAcct),
        issue_date: todayStr(),
      });
      if (settlement === "reduce") {
        const newBal = round2(Number(si.balance_due) - creditAmt);
        updateSI.mutate({
          id: si.id,
          changes: { balance_due: Math.max(0, newBal), status: newBal <= 0 ? "credited" : si.status },
        });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the credit.");
      setBusy(false);
    }
  }

  const segBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "9px 10px",
    borderRadius: 10,
    border: `1.5px solid ${active ? "#6d28d9" : "#e5e7eb"}`,
    background: active ? "#f5f3ff" : "#fff",
    color: active ? "#6d28d9" : "#6b7280",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  });

  return (
    <Modal title={si.supplier_ref_number ? `Invoice ${si.supplier_ref_number}` : "Supplier invoice"} onClose={onClose}>
      <div style={{ marginBottom: 16 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 20,
            background: status.bg,
            color: status.fg,
            textTransform: "uppercase",
          }}
        >
          {status.label}
        </span>
      </div>

      <Row label="Supplier" value={si.supplier_name} />
      <Row label="Invoice date" value={si.issue_date} />
      <Row label="Due date" value={si.due_date ?? "—"} />

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#374151", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
            <span>
              {it.desc} {Number(it.qty) > 1 ? `×${it.qty}` : ""}
            </span>
            <span>{fmt(Number(it.qty || 0) * Number(it.unit_price || 0))}</span>
          </div>
        ))}
      </div>

      <Row label="Total" value={fmt(totalInclVat)} />
      {si.paid_amount ? <Row label="Already paid" value={fmt(si.paid_amount)} /> : null}
      <Row label="Balance you owe" value={fmt(balanceOwed)} bold />

      {access.canEdit && si.status !== "credited" && (
        <div style={{ marginTop: 16, border: "1.5px solid #ede9fe", borderRadius: 14, overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => setShowCredit((s) => !s)}
            style={{
              width: "100%",
              padding: "13px 14px",
              border: "none",
              background: "#f5f3ff",
              color: "#6d28d9",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>↩️ Supplier credited me</span>
            <span style={{ fontSize: 12 }}>{showCredit ? "▲" : "▼"}</span>
          </button>

          {showCredit && (
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>What did they credit?</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button type="button" onClick={() => setScope("whole")} style={segBtn(scope === "whole")}>
                  Whole invoice
                </button>
                <button type="button" onClick={() => setScope("lines")} style={segBtn(scope === "lines")}>
                  Specific lines
                </button>
              </div>

              {scope === "lines" && (
                <div style={{ marginBottom: 14 }}>
                  {items.map((it, i) => (
                    <label
                      key={i}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#374151", cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        checked={!!selected[i]}
                        onChange={(e) => setSelected((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
                      />
                      <span style={{ flex: 1 }}>
                        {it.desc} {Number(it.qty) > 1 ? `×${it.qty}` : ""}
                      </span>
                      <span>{fmt(Number(it.qty || 0) * Number(it.unit_price || 0))}</span>
                    </label>
                  ))}
                </div>
              )}

              <Field label="Reason (optional)">
                <Input value={reason} onChange={setReason} placeholder="e.g. returned goods, overcharge" />
              </Field>

              {!isPaid && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>How to settle it</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <button type="button" onClick={() => setChosenSettlement("reduce")} style={segBtn(chosenSettlement === "reduce")}>
                      Reduce what you owe them
                    </button>
                    <button type="button" onClick={() => setChosenSettlement("account")} style={segBtn(chosenSettlement === "account")}>
                      Hold on account (pay less next / they refund you)
                    </button>
                  </div>
                </>
              )}

              {isPaid && (
                <div style={{ background: "#f5f3ff", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "#6d28d9", marginBottom: 14 }}>
                  This invoice is settled, so the credit is held on account (pay less next time or they refund you).
                </div>
              )}

              <div style={{ background: "#f5f3ff", borderRadius: 12, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: "#5b21b6" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 15 }}>
                  <span>Credit amount{hasVat ? " (incl. VAT)" : ""}</span>
                  <span>{fmt(creditAmt)}</span>
                </div>
                {hasVat && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span>VAT within — reverses input VAT</span>
                    <span>{fmt(creditVat)}</span>
                  </div>
                )}
                {alreadyCredited > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span>Already credited</span>
                    <span>{fmt(alreadyCredited)}</span>
                  </div>
                )}
              </div>

              {overCredit && (
                <p style={{ color: "#dc2626", fontSize: 12.5, marginBottom: 12 }}>
                  That is more than the {fmt(creditable)} still creditable on this invoice.
                </p>
              )}
              {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}

              <button
                type="button"
                onClick={handleCreateCredit}
                disabled={!canCreate}
                style={{
                  width: "100%",
                  background: canCreate ? "#6d28d9" : "#c4b5fd",
                  color: "#fff",
                  border: "none",
                  borderRadius: 14,
                  padding: 15,
                  fontWeight: 700,
                  cursor: canCreate ? "pointer" : "not-allowed",
                }}
              >
                {busy || createCN.isPending ? "Recording..." : "Record credit note"}
              </button>
            </div>
          )}
        </div>
      )}

      {si.status !== "paid" && si.status !== "credited" && (
        <button
          onClick={() =>
            updateSI.mutate(
              {
                id: si.id,
                changes: { status: "paid", paid_date: todayStr(), paid_amount: si.invoice_amount, balance_due: 0 },
              },
              { onSuccess: onClose }
            )
          }
          style={{ width: "100%", background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 14, padding: 16, fontWeight: 700, cursor: "pointer", marginTop: 12 }}
        >
          ✅ Mark Paid
        </button>
      )}
    </Modal>
  );
}
