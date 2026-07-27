"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Row } from "@/components/ui/Row";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { DocumentActions } from "@/components/ui/DocumentActions";
import { buildInvoiceText, buildCreditNoteText } from "@/lib/docgen/shareText";
import type { DocForRender } from "@/lib/docgen/buildDocumentHTML";
import { fmt, todayStr } from "@/lib/format";
import { salesLineTotal } from "@/lib/lineItems";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { useUpdateInvoice, type Invoice } from "@/lib/supabase/hooks/useInvoices";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTaxRates } from "@/lib/taxRates";
import { useCreditNotes, useCreateCreditNote } from "@/lib/supabase/hooks/useCreditNotes";
import { creditVatWithin, initialOnAccount, initialStatus, creditedAgainstInvoice, round2 } from "@/lib/creditNotes";
import { getNextDocNumber } from "@/lib/docNumber";
import { createClient } from "@/lib/supabase/client";

export function displayStatus(invoice: Invoice): { label: string; bg: string; fg: string } {
  if (invoice.status === "credited") return { label: "credited", bg: "#f5f3ff", fg: "#6d28d9" };
  if (invoice.status === "paid") return { label: "paid", bg: "#F0F9FF", fg: "#0369A1" };
  const isOverdue = !!invoice.due_date && invoice.due_date < todayStr();
  const isPartial = Number(invoice.deposit_received || 0) > 0 && Number(invoice.deposit_received || 0) < Number(invoice.invoice_amount);
  if (isOverdue) return { label: "overdue", bg: "#fee2e2", fg: "#991b1b" };
  if (isPartial) return { label: "partial", bg: "#fff7ed", fg: "#b45309" };
  return { label: "unpaid", bg: "#fff7ed", fg: "#b45309" };
}

export function InvoiceActionsModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const updateInvoice = useUpdateInvoice();
  const access = useToolAccess("invoice");
  const { data: business } = useBusinessProfile();
  const { VAT_RATE } = useTaxRates();
  const creditNotes = useCreditNotes().data ?? [];
  const createCreditNote = useCreateCreditNote();
  const supabase = createClient();
  const hasVat = !!business?.vat_number;

  const items = (invoice.line_items as Array<{ desc: string; qty: number; unit_price?: number; labour?: number; materials?: number }>) ?? [];
  const status = displayStatus(invoice);
  const totalInclVat = Number(invoice.invoice_amount) + Number(invoice.vat_amount ?? 0);
  // Marking an invoice paid zeroes balance_due but leaves vat_amount alone, so
  // adding the two would show a paid VAT invoice as still owing the VAT.
  // Nothing is outstanding once balance_due is zero.
  const balanceDue = Number(invoice.balance_due);
  const balanceInclVat = balanceDue > 0 ? balanceDue + Number(invoice.vat_amount ?? 0) : 0;

  // ── Credit-this-invoice state + math ──
  const [showCredit, setShowCredit] = useState(false);
  const [scope, setScope] = useState<"whole" | "lines">("whole");
  const [selected, setSelected] = useState<boolean[]>(() => items.map(() => false));
  const [reason, setReason] = useState("");
  const [chosenSettlement, setChosenSettlement] = useState<"reduce" | "account">("reduce");

  // Balance owing is VAT-inclusive: balance_due is ex-VAT while any is owing, so
  // add the full VAT snapshot back on. A paid invoice owes nothing.
  const balanceOwing = invoice.status === "paid" ? 0 : (Number(invoice.balance_due) > 0 ? Number(invoice.balance_due) + Number(invoice.vat_amount ?? 0) : 0);
  const isPaid = invoice.status === "paid" || balanceOwing <= 0;
  // ex-VAT total of the chosen lines (salesLineTotal per line mirrors invoice_amount):
  const exVatChosen = scope === "whole"
    ? Number(invoice.invoice_amount)
    : items.reduce((s, it, i) => s + (selected[i] ? salesLineTotal(it) : 0), 0);
  const creditAmt = hasVat ? round2(exVatChosen * (1 + VAT_RATE)) : round2(exVatChosen);
  const creditVat = creditVatWithin(creditAmt, VAT_RATE, hasVat);
  const alreadyCredited = creditedAgainstInvoice(creditNotes, invoice.id);
  const creditable = round2(totalInclVat - alreadyCredited);
  const invoiceCredits = creditNotes.filter((c) => c.invoice_id === invoice.id);

  const handleCreateCredit = async () => {
    if (!business || creditAmt <= 0 || creditAmt > creditable) return;
    const settlement = isPaid ? "account" : chosenSettlement;
    const onAcct = initialOnAccount(creditAmt, balanceOwing, settlement);
    await createCreditNote.mutateAsync({
      doc_number: await getNextDocNumber(supabase, business.id, "CN"),
      ledger: "customer",
      invoice_id: invoice.id,
      supplier_invoice_id: null,
      original_doc_number: invoice.doc_number,
      contact_id: invoice.client_contact_id,
      contact_name: invoice.client_name,
      amount: creditAmt,
      vat_rate: hasVat ? VAT_RATE : null,
      vat_amount: creditVat,
      scope,
      line_items: scope === "lines" ? items.filter((_, i) => selected[i]) : items,
      reason: reason || null,
      settlement,
      on_account_balance: onAcct,
      status: initialStatus(onAcct),
      issue_date: todayStr(),
    });
    if (settlement === "reduce") {
      // Reducing balance_due by the VAT-INCLUSIVE creditAmt is correct: vat_amount
      // stays the full snapshot and balanceInclVat only adds it while balance_due>0,
      // so (balance_due − creditAmt) + vat_amount === old-incl-balance − creditAmt.
      // Leave vat_amount UNCHANGED (VAT201 subtracts the credit's VAT separately).
      const newBal = round2(Number(invoice.balance_due) - creditAmt);
      updateInvoice.mutate({ id: invoice.id, changes: { balance_due: Math.max(0, newBal), status: newBal <= 0 ? "credited" : invoice.status } });
    }
    onClose();
  };

  const canCreate = creditAmt > 0 && creditAmt <= creditable && !createCreditNote.isPending;

  return (
    <Modal title={invoice.doc_number} onClose={onClose}>
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

      <Row label="Client" value={invoice.client_name} />
      <Row label="Issue date" value={invoice.issue_date} />
      <Row label="Due date" value={invoice.due_date ?? "—"} />

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#374151", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
            <span>
              {it.desc} {it.qty > 1 ? `×${it.qty}` : ""}
            </span>
            <span>{fmt(salesLineTotal(it))}</span>
          </div>
        ))}
      </div>

      <Row label="Total" value={fmt(totalInclVat)} />
      {invoice.deposit_received ? <Row label="Deposit received" value={fmt(invoice.deposit_received)} /> : null}
      <Row label="Balance due" value={fmt(balanceInclVat)} bold />

      <DocumentActions
        kind="invoice"
        sourceId={invoice.id}
        shareText={buildInvoiceText(invoice)}
        doc={
          {
            doc_number: invoice.doc_number,
            issue_date: invoice.issue_date,
            recipient_name: invoice.client_name,
            line_items: items,
            subtotal: Number(invoice.invoice_amount),
            vat_rate: invoice.vat_rate,
            vat_amount: Number(invoice.vat_amount ?? 0),
            deposit: Number(invoice.deposit_received ?? 0),
            balance_due: invoice.balance_due,
            due_date: invoice.due_date,
          } satisfies DocForRender
        }
      />

      {invoiceCredits.map((cn) => (
        <div key={cn.id} style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6d28d9", marginBottom: 6 }}>
            📤 Send credit note {cn.doc_number} — {fmt(Number(cn.amount))}
          </div>
          <DocumentActions
            kind="creditnote"
            sourceId={cn.id}
            shareText={buildCreditNoteText(cn)}
            doc={
              {
                doc_number: cn.doc_number,
                issue_date: cn.issue_date,
                recipient_name: cn.contact_name,
                line_items: (cn.line_items as DocForRender["line_items"]) ?? [],
                subtotal: Number(cn.amount) - Number(cn.vat_amount ?? 0),
                vat_rate: cn.vat_rate,
                vat_amount: Number(cn.vat_amount ?? 0),
                deposit: 0,
                reference_doc_number: cn.original_doc_number,
                reason: cn.reason,
              } satisfies DocForRender
            }
          />
        </div>
      ))}

      {access.canEdit && invoice.status !== "credited" && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowCredit((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#fff7ed",
              color: "#b45309",
              border: "1.5px solid #fed7aa",
              borderRadius: 14,
              padding: 14,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <span>↩️ Credit this invoice</span>
            <span>{showCredit ? "▲" : "▼"}</span>
          </button>

          {showCredit && (
            <div style={{ border: "1.5px solid #fed7aa", borderTop: "none", borderRadius: "0 0 14px 14px", background: "#fffbeb", padding: 14, marginTop: -2 }}>
              {/* Scope toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button
                  onClick={() => setScope("whole")}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    border: scope === "whole" ? "1.5px solid #d97706" : "1.5px solid #fed7aa",
                    background: scope === "whole" ? "#d97706" : "#fff",
                    color: scope === "whole" ? "#fff" : "#b45309",
                  }}
                >
                  Whole invoice
                </button>
                <button
                  onClick={() => setScope("lines")}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    border: scope === "lines" ? "1.5px solid #d97706" : "1.5px solid #fed7aa",
                    background: scope === "lines" ? "#d97706" : "#fff",
                    color: scope === "lines" ? "#fff" : "#b45309",
                  }}
                >
                  Specific lines
                </button>
              </div>

              {/* Line picker */}
              {scope === "lines" && (
                <div style={{ marginBottom: 14 }}>
                  {items.map((it, i) => (
                    <label
                      key={i}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 13, color: "#374151", padding: "6px 0", cursor: "pointer" }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={selected[i] ?? false}
                          onChange={() =>
                            setSelected((prev) => {
                              const next = [...prev];
                              next[i] = !next[i];
                              return next;
                            })
                          }
                        />
                        {it.desc}
                      </span>
                      <span>{fmt(salesLineTotal(it))}</span>
                    </label>
                  ))}
                </div>
              )}

              <Field label="Reason">
                <Input value={reason} onChange={setReason} placeholder="e.g. Returned materials" />
              </Field>

              <Row label="Credit amount" value={fmt(creditAmt)} bold />
              {hasVat ? <Row label="VAT included" value={fmt(creditVat)} /> : null}
              {alreadyCredited > 0 ? <Row label="Already credited" value={fmt(alreadyCredited)} /> : null}
              <Row label="Creditable remaining" value={fmt(creditable)} />

              {/* Settlement chooser — only when there is a balance to reduce */}
              {!isPaid && creditAmt > 0 && (
                <div style={{ marginTop: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>How to settle</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setChosenSettlement("reduce")}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        borderRadius: 10,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        border: chosenSettlement === "reduce" ? "1.5px solid #d97706" : "1.5px solid #fed7aa",
                        background: chosenSettlement === "reduce" ? "#d97706" : "#fff",
                        color: chosenSettlement === "reduce" ? "#fff" : "#b45309",
                      }}
                    >
                      Reduce what they owe
                    </button>
                    <button
                      onClick={() => setChosenSettlement("account")}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        borderRadius: 10,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        border: chosenSettlement === "account" ? "1.5px solid #d97706" : "1.5px solid #fed7aa",
                        background: chosenSettlement === "account" ? "#d97706" : "#fff",
                        color: chosenSettlement === "account" ? "#fff" : "#b45309",
                      }}
                    >
                      Put on account
                    </button>
                  </div>
                </div>
              )}

              {isPaid && creditAmt > 0 && (
                <div style={{ fontSize: 12, color: "#b45309", background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 10, padding: 10, marginTop: 12, marginBottom: 12 }}>
                  This invoice is paid, so the credit sits on account — a refund you owe the customer.
                </div>
              )}

              {creditAmt > creditable && (
                <div style={{ fontSize: 12, color: "#991b1b", background: "#fee2e2", borderRadius: 10, padding: 10, marginBottom: 12 }}>
                  Credit exceeds what is left to credit on this invoice ({fmt(creditable)}).
                </div>
              )}

              <button
                onClick={handleCreateCredit}
                disabled={!canCreate}
                style={{
                  width: "100%",
                  background: canCreate ? "#d97706" : "#fca5a5",
                  color: "#fff",
                  border: "none",
                  borderRadius: 14,
                  padding: 16,
                  fontWeight: 700,
                  cursor: canCreate ? "pointer" : "not-allowed",
                }}
              >
                {createCreditNote.isPending ? "Creating…" : "↩️ Create credit note"}
              </button>
            </div>
          )}
        </div>
      )}

      {invoice.status !== "paid" && access.canEdit && (
        <button
          onClick={() =>
            updateInvoice.mutate(
              { id: invoice.id, changes: { status: "paid", paid_date: todayStr(), balance_due: 0 } },
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
