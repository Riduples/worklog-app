"use client";

import { useState } from "react";
import { useInvoices } from "@/lib/supabase/hooks/useInvoices";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTrialState } from "@/lib/supabase/hooks/useSubscription";
import { useCreditNotes, useUpdateCreditNote, type CreditNote } from "@/lib/supabase/hooks/useCreditNotes";
import { useCreateExpense } from "@/lib/supabase/hooks/useExpenses";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { buildStatementHTML, type StatementLine } from "@/lib/docgen/buildLedgerHTML";
import { openDocumentForPrinting, shareDocumentText } from "@/lib/docgen/shareDocument";
import { renderPdf, downloadBlob } from "@/lib/docgen/renderPdf";
import { fmt, todayStr } from "@/lib/format";
import { balanceInclVat } from "@/lib/balance";
import { sumOnAccount, round2 } from "@/lib/creditNotes";
import { BackLink } from "@/components/ui/BackLink";

export function StatementView() {
  const { data: invoices } = useInvoices();
  const { data: contacts } = useContacts();
  const { data: business } = useBusinessProfile();
  const { data: creditNotes } = useCreditNotes();
  const updateCreditNote = useUpdateCreditNote();
  const createExpense = useCreateExpense();
  const { isTrialing, isReadOnly } = useTrialState();
  const watermark = isTrialing || isReadOnly;

  const [selectedClient, setSelectedClient] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const clientNames = [
    ...new Set([
      ...(contacts ?? []).filter((c) => c.contact_type === "client").map((c) => c.name),
      ...(invoices ?? []).map((i) => i.client_name),
    ]),
  ]
    .filter(Boolean)
    .sort();

  const clientInvoices = (invoices ?? [])
    .filter((i) => i.client_name === selectedClient)
    .sort((a, b) => a.issue_date.localeCompare(b.issue_date));

  const totalInvoiced = clientInvoices.reduce((s, i) => s + Number(i.invoice_amount) + Number(i.vat_amount ?? 0), 0);
  const totalOutstanding = clientInvoices
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + balanceInclVat(i.balance_due, i.vat_amount), 0);
  const totalReceived = totalInvoiced - totalOutstanding;

  // Credit notes on this customer's ledger. On-account credits are owed back to
  // the customer, so they net down what this customer still owes us.
  const custCredits = (creditNotes ?? []).filter((c) => c.ledger === "customer" && c.contact_name === selectedClient);
  const onAccount = sumOnAccount(custCredits, "customer");
  const netOutstanding = round2(totalOutstanding - onAccount);

  const statementCredits = {
    lines: custCredits.map((c) => ({
      date: c.issue_date,
      reference: c.doc_number + (c.original_doc_number ? " vs " + c.original_doc_number : ""),
      amount: Number(c.amount),
      status: c.status,
    })),
    onAccount,
    netOutstanding,
  };

  const creditStatusLabel = (s: string) => (s === "on_account" ? "On account" : s === "applied" ? "Applied" : "Refunded");
  const creditPill = (s: string): { background: string; color: string } =>
    s === "on_account"
      ? { background: "#fff7ed", color: "#b45309" }
      : s === "applied"
        ? { background: "#F0F9FF", color: "#0369A1" }
        : { background: "#f1f5f9", color: "#64748b" };

  const applyCreditToInvoice = (cn: CreditNote) => {
    updateCreditNote.mutate({ id: cn.id, changes: { status: "applied", on_account_balance: 0 } });
  };

  const refundCredit = (cn: CreditNote) => {
    createExpense.mutate({
      amount: cn.on_account_balance || cn.amount,
      transaction_date: todayStr(),
      sars_category: "Customer refunds",
      paid_to: cn.contact_name,
      payment_method: "EFT / Bank transfer",
      details: "Refund vs " + cn.doc_number,
      is_credit_settlement: true,
      credit_note_id: cn.id,
    });
    updateCreditNote.mutate({ id: cn.id, changes: { status: "refunded", on_account_balance: 0 } });
  };

  const asAt = new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });

  const owedFor = (name: string) =>
    (invoices ?? [])
      .filter((i) => i.client_name === name && i.status !== "paid")
      .reduce((s, i) => s + balanceInclVat(i.balance_due, i.vat_amount), 0);

  const handlePrint = async () => {
    if (!business || busy) return;
    setBusy(true);
    const lines: StatementLine[] = clientInvoices.map((i) => ({
      date: i.issue_date,
      reference: i.doc_number,
      amount: Number(i.invoice_amount) + Number(i.vat_amount ?? 0),
      balance: balanceInclVat(i.balance_due, i.vat_amount),
      paid: i.status === "paid",
    }));
    const totals = { invoiced: totalInvoiced, received: totalReceived, outstanding: totalOutstanding };
    const credits = custCredits.length ? statementCredits : undefined;
    const filename = `statement-${selectedClient.replace(/\s+/g, "-")}`;
    try {
      const blob = await renderPdf({ kind: "statement", clientName: selectedClient, lines, totals, asAt, credits });
      downloadBlob(blob, filename);
    } catch {
      // Fall back to the print flow rather than leaving the user stuck.
      openDocumentForPrinting(buildStatementHTML(business, selectedClient, lines, totals, asAt, watermark, credits), filename);
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    const parts = [
      `ACCOUNT STATEMENT — ${selectedClient}`,
      `As at ${asAt}`,
      ``,
      `Total invoiced: ${fmt(totalInvoiced)}`,
      `Total received: ${fmt(totalReceived)}`,
      `Balance outstanding: ${fmt(totalOutstanding)}`,
    ];
    if (onAccount > 0) {
      parts.push(`Credit on account (owed back): −${fmt(onAccount)}`);
      parts.push(`Net outstanding: ${fmt(netOutstanding)}`);
    }
    parts.push(``, `Generated by Worklog`);
    await shareDocumentText(`Statement — ${selectedClient}`, parts.join("\n"));
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <BackLink />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>Customer Statement</h1>

      <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "12px 14px", marginBottom: 18, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
        A statement shows a customer their full account history — all invoices issued and what they still owe. Share it to resolve disputes or as a payment reminder.
      </div>

      <Field label="Select customer">
        <div style={{ position: "relative" }}>
          <Input value={selectedClient} onChange={setSelectedClient} placeholder="Type name or tap List..." />
          {clientNames.length > 0 && (
            <button
              onClick={() => setShowPicker((p) => !p)}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "#0C4A6E", border: "none", borderRadius: 8, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              {showPicker ? "✕" : "👤 List"}
            </button>
          )}
        </div>
        {showPicker && (
          <div style={{ background: "#fff", border: "1.5px solid #BAE6FD", borderRadius: 12, marginTop: 6, overflow: "hidden", maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            {clientNames.map((n) => {
              const owed = owedFor(n);
              return (
                <button
                  key={n}
                  onClick={() => {
                    setSelectedClient(n);
                    setShowPicker(false);
                  }}
                  style={{ width: "100%", padding: "11px 14px", border: "none", borderBottom: "1px solid #F0F9FF", background: "#fff", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{n}</span>
                  {owed > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#b45309", background: "#fff7ed", padding: "3px 8px", borderRadius: 10 }}>{fmt(owed)} owed</span>}
                </button>
              );
            })}
          </div>
        )}
      </Field>

      {selectedClient && clientInvoices.length === 0 && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: "14px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          No invoices found for {selectedClient}
        </div>
      )}

      {selectedClient && clientInvoices.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Total invoiced", value: fmt(totalInvoiced), color: "#0C4A6E" },
              { label: "Received", value: fmt(totalReceived), color: "#0369A1" },
              onAccount > 0
                ? { label: "Net outstanding", value: fmt(netOutstanding), color: netOutstanding > 0 ? "#b45309" : "#0C4A6E" }
                : { label: "Outstanding", value: fmt(totalOutstanding), color: totalOutstanding > 0 ? "#b45309" : "#0C4A6E" },
            ].map((s) => (
              <div key={s.label} style={{ background: "#f8fafc", borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {onAccount > 0 && (
            <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "11px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#38BDF8", fontWeight: 700 }}>Credit on account (owed back)</span>
              <span style={{ fontSize: 15, color: "#fff", fontWeight: 800 }}>−{fmt(onAccount)}</span>
            </div>
          )}

          {clientInvoices.map((inv) => {
            const paid = inv.status === "paid";
            const total = Number(inv.invoice_amount) + Number(inv.vat_amount ?? 0);
            const balance = balanceInclVat(inv.balance_due, inv.vat_amount);
            return (
              <div key={inv.id} style={{ background: paid ? "#F0F9FF" : "#fff7ed", borderRadius: 12, padding: "11px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{inv.doc_number}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {inv.issue_date}
                    {inv.due_date ? ` · Due ${inv.due_date}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: paid ? "#0369A1" : "#b45309" }}>
                  {paid ? `✓ ${fmt(total)}` : `${fmt(balance)} due`}
                </div>
              </div>
            );
          })}

          {custCredits.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
                ↩️ Credit notes
              </div>
              {custCredits.map((cn) => {
                const pill = creditPill(cn.status);
                return (
                  <div key={cn.id} style={{ background: "#f8fafc", borderRadius: 12, padding: "11px 14px", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>
                          {cn.doc_number}
                          {cn.original_doc_number ? ` · vs ${cn.original_doc_number}` : ""}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          {cn.issue_date}
                          {cn.reason ? ` · ${cn.reason}` : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#0C4A6E" }}>−{fmt(Number(cn.amount))}</div>
                        <span style={{ display: "inline-block", marginTop: 4, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: pill.background, color: pill.color }}>
                          {creditStatusLabel(cn.status)}
                        </span>
                      </div>
                    </div>
                    {cn.status === "on_account" && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button
                          onClick={() => applyCreditToInvoice(cn)}
                          style={{ flex: 1, background: "#F0F9FF", color: "#0369A1", border: "1.5px solid #BAE6FD", borderRadius: 10, padding: "9px 8px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                        >
                          ✓ Applied to invoice
                        </button>
                        <button
                          onClick={() => refundCredit(cn)}
                          style={{ flex: 1, background: "#fff7ed", color: "#b45309", border: "1.5px solid #fed7aa", borderRadius: 10, padding: "9px 8px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                        >
                          💸 Refund paid
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
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
    </div>
  );
}
