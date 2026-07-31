"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { ContactPicker } from "@/components/ui/ContactPicker";
import { SalesLineItemsEditor } from "@/components/ui/SalesLineItemsEditor";
import { salesLinesSubtotal } from "@/lib/lineItems";
import { fmt, todayStr, addDays } from "@/lib/format";
import { useTaxRates } from "@/lib/taxRates";
import { getNextDocNumber } from "@/lib/docNumber";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useCreateInvoice, useConvertQuoteToInvoice } from "@/lib/supabase/hooks/useInvoices";
import { useQuotes, type Quote, type QuoteLineItem } from "@/lib/supabase/hooks/useQuotes";
import { createClient } from "@/lib/supabase/client";
import { RECURRENCE_OPTIONS, recurrenceNext, type Recurrence } from "@/lib/recurrence";
import { UPGRADE_DETAILS, type Plan } from "@/lib/tiers";

export function InvoiceModal({ sourceQuote, onClose }: { sourceQuote?: Quote; onClose: () => void }) {
  const [client, setClient] = useState(sourceQuote?.client_name ?? "");
  const [clientContactId, setClientContactId] = useState<string | null>(sourceQuote?.client_contact_id ?? null);
  const [issueDate, setIssueDate] = useState(todayStr());
  const [dueDate, setDueDate] = useState(addDays(todayStr(), 30));
  const [items, setItems] = useState<QuoteLineItem[]>(
    (sourceQuote?.line_items as QuoteLineItem[]) ?? [{ desc: "", qty: 1, unit_price: 0 }]
  );
  const [depositReceived, setDepositReceived] = useState(String(sourceQuote?.deposit_requested ?? 0));
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [srcQuote, setSrcQuote] = useState<Quote | null>(sourceQuote ?? null);
  const [terms, setTerms] = useState("");
  const [termsSeeded, setTermsSeeded] = useState(false);
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const { data: quotes } = useQuotes();
  const { data: business } = useBusinessProfile();
  const { VAT_RATE } = useTaxRates();
  const createInvoice = useCreateInvoice();
  const convertQuote = useConvertQuoteToInvoice();
  const saving = createInvoice.isPending || convertQuote.isPending;

  // Seed the terms from the owner's default INVOICE terms once the profile loads
  // (an invoice, whether blank or converted from a quote, gets the invoice terms —
  // its own default, not the quote's). Render-time seed, not an effect, and only
  // before the owner has edited the field.
  if (!termsSeeded && business) {
    setTermsSeeded(true);
    if (business.default_invoice_terms) setTerms(business.default_invoice_terms);
  }

  const subtotal = salesLinesSubtotal(items);
  const isVatRegistered = !!business?.vat_number;
  const vatAmount = isVatRegistered ? subtotal * VAT_RATE : 0;
  const depositNum = parseFloat(depositReceived) || 0;
  const balanceDue = subtotal - depositNum;

  // Recurring invoices are a Trade+ feature — locked on Solo. Converting a quote
  // stays once-off: convert_quote_to_invoice takes no recurrence params, and a
  // quote is a one-time agreement anyway.
  const plan = (business?.plan ?? "solo") as Plan;
  const canRecur = !srcQuote && plan !== "solo";
  // The template is itself the first invoice, so the next run is one interval
  // after its issue date — never the issue date itself, which would double-bill.
  const nextRunDate = recurrence === "none" ? null : recurrenceNext(issueDate, recurrence);

  // Start a new invoice FROM an existing quote — the in-form alternative to
  // converting from the quote side. Only quotes not already converted are offered;
  // picking one loads its customer + line items and switches Save to a real
  // convert (marks the quote converted via convert_quote_to_invoice).
  const convertibleQuotes = (quotes ?? []).filter((q) => !q.converted_to_invoice_id && q.status !== "declined");
  const pickQuote = (id: string) => {
    const q = id ? convertibleQuotes.find((x) => x.id === id) ?? null : null;
    setSrcQuote(q);
    setClient(q?.client_name ?? "");
    setClientContactId(q?.client_contact_id ?? null);
    setItems((q?.line_items as QuoteLineItem[] | undefined) ?? [{ desc: "", qty: 1, unit_price: 0 }]);
    setDepositReceived(String(q?.deposit_requested ?? 0));
  };

  const handleSave = async () => {
    if (!client.trim()) {
      setError("Customer is required.");
      return;
    }
    if (!items.some((it) => it.desc || it.unit_price || it.labour || it.materials)) {
      setError("Add at least one line item.");
      return;
    }
    if (!business) return;
    setError("");

    const supabase = createClient();
    const docNumber = await getNextDocNumber(supabase, business.id, "INV");
    const filteredItems = items.filter((it) => it.desc || it.unit_price || it.labour || it.materials);

    if (srcQuote) {
      convertQuote.mutate(
        {
          quoteId: srcQuote.id,
          docNumber,
          lineItems: filteredItems,
          invoiceAmount: subtotal,
          depositReceived: depositNum,
          vatRate: isVatRegistered ? VAT_RATE : null,
          vatAmount,
          issueDate,
          dueDate: dueDate || null,
          terms: terms.trim() || null,
        },
        { onSuccess: onClose }
      );
    } else {
      createInvoice.mutate(
        {
          doc_number: docNumber,
          client_contact_id: clientContactId,
          client_name: client.trim(),
          line_items: filteredItems,
          invoice_amount: subtotal,
          deposit_received: depositNum,
          balance_due: balanceDue,
          issue_date: issueDate,
          due_date: dueDate || null,
          status: "unpaid",
          vat_rate: isVatRegistered ? VAT_RATE : null,
          vat_amount: vatAmount,
          terms: terms.trim() || null,
          recurrence: canRecur ? recurrence : "none",
          next_run_date: canRecur ? nextRunDate : null,
        },
        { onSuccess: onClose }
      );
    }
  };

  return (
    <Modal title={srcQuote ? `Convert ${srcQuote.doc_number} to invoice` : "New invoice"} onClose={onClose}>
      {!sourceQuote && convertibleQuotes.length > 0 && (
        <Field label="Start from a quote (optional)">
          <select
            value={srcQuote?.id ?? ""}
            onChange={(e) => pickQuote(e.target.value)}
            style={{ width: "100%", padding: "11px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", background: "#fff" }}
          >
            <option value="">— None (blank invoice) —</option>
            {convertibleQuotes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.doc_number} · {q.client_name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <ContactPicker
        label="Customer / Company name"
        value={client}
        onChange={(v, id) => {
          setClient(v);
          setClientContactId(id);
        }}
        contacts={contacts ?? []}
        placeholder="Customer name — or pick from your customers"
      />

      <Field label="Issue date">
        <Input value={issueDate} onChange={setIssueDate} type="date" />
      </Field>

      <Field label="Due date">
        <Input value={dueDate} onChange={setDueDate} type="date" />
      </Field>

      {!srcQuote && (
        <Field label="Repeat this invoice">
          {!canRecur ? (
            <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "11px 14px", fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
              🔁 <span style={{ fontWeight: 700 }}>{UPGRADE_DETAILS.invoice_recurring?.title} are a Business feature.</span>{" "}
              {UPGRADE_DETAILS.invoice_recurring?.desc}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {RECURRENCE_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setRecurrence(o.id)}
                    style={{
                      padding: "9px 14px",
                      borderRadius: 20,
                      border: `1.5px solid ${recurrence === o.id ? "#0C4A6E" : "#e2e8f0"}`,
                      background: recurrence === o.id ? "#0C4A6E" : "#fff",
                      color: recurrence === o.id ? "#fff" : "#374151",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {nextRunDate && (
                <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 10, padding: "9px 12px", marginTop: 8, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
                  🔁 This invoice goes out now. Worklog then creates the next one automatically on{" "}
                  <strong>{nextRunDate}</strong>, and every {RECURRENCE_OPTIONS.find((o) => o.id === recurrence)?.every} after that.
                </div>
              )}
            </>
          )}
        </Field>
      )}

      <SalesLineItemsEditor items={items} onChange={setItems} />

      <Field label="Deposit already received">
        <Input value={depositReceived} onChange={setDepositReceived} type="number" placeholder="0.00" />
      </Field>

      <Field label="Terms & conditions (optional)">
        <Textarea value={terms} onChange={setTerms} placeholder="e.g. Payment due within 30 days. 2% monthly interest on overdue accounts. Goods remain our property until paid in full." rows={4} />
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
          Prints at the foot of the invoice. Set a default in Business details so it fills in automatically.
        </div>
      </Field>

      <div style={{ background: "#F0F9FF", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#0369A1" }}>
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
        {depositNum > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Deposit received</span>
            <span>−{fmt(depositNum)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, marginTop: 6, paddingTop: 6, borderTop: "1.5px solid #BAE6FD" }}>
          <span>Balance due{isVatRegistered ? " (incl. VAT)" : ""}</span>
          <span>{fmt(balanceDue + vatAmount)}</span>
        </div>
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : "Save invoice"} onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
