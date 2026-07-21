"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { ContactPicker } from "@/components/ui/ContactPicker";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";
import { SarsSuggestionDropdown } from "@/components/ui/SarsSuggestionDropdown";
import { InvoiceMatcher, paymentSettlesInvoice } from "@/components/ui/InvoiceMatcher";
import { getSarsIncomeMatch, type SarsCategory } from "@/lib/sarsCategories";
import { fmt, todayStr } from "@/lib/format";
import { useTaxRates } from "@/lib/taxRates";
import { useCreateIncome } from "@/lib/supabase/hooks/useIncome";
import { useInvoices, useUpdateInvoice } from "@/lib/supabase/hooks/useInvoices";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useBankAccounts } from "@/lib/supabase/hooks/useBankAccounts";
import { BankAccountPicker } from "@/components/ui/BankAccountPicker";

export function IncomeModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [whatFor, setWhatFor] = useState("");
  const [sarsCategory, setSarsCategory] = useState<SarsCategory | null>(null);
  const [showSarsSuggestions, setShowSarsSuggestions] = useState(false);
  const [receivedFrom, setReceivedFrom] = useState("");
  const [receivedFromContactId, setReceivedFromContactId] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [method, setMethod] = useState("Cash");
  const [date, setDate] = useState(todayStr());
  const [matchedInvoiceId, setMatchedInvoiceId] = useState<string | null>(null);
  const [markPaid, setMarkPaid] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const { data: invoices } = useInvoices();
  const { data: business } = useBusinessProfile();
  const createIncome = useCreateIncome();
  const updateInvoice = useUpdateInvoice();
  const { TAX_JAR_RATE, VAT_RATE, vatFromGross } = useTaxRates();
  const { data: accounts } = useBankAccounts();

  // Default new entries to the business's default account, once, so tagging is
  // zero-effort for the common single-primary-account case — without overriding
  // a deliberate clear.
  const didInitAccount = useRef(false);
  useEffect(() => {
    if (!didInitAccount.current && accounts) {
      didInitAccount.current = true;
      setAccountId(accounts.find((a) => a.is_default)?.id ?? null);
    }
  }, [accounts]);

  // The amount typed is the cash that arrived, so any VAT is already inside it
  // and has to be taken back out — unlike an invoice, which is built up from an
  // ex-VAT subtotal with VAT added on top.
  const amountNum = parseFloat(amount) || 0;
  const isVatRegistered = !!business?.vat_number;
  const vatAmount = isVatRegistered ? vatFromGross(amountNum, VAT_RATE) : 0;
  const netAmount = amountNum - vatAmount;
  // Provision income tax on what the business actually earned. The VAT portion
  // is SARS's money being held, not income, so it must not be provisioned twice.
  const taxJar = netAmount * TAX_JAR_RATE;

  const matchedInvoice = (invoices ?? []).find((i) => i.id === matchedInvoiceId) ?? null;
  const settlesInvoice = paymentSettlesInvoice(matchedInvoice, amountNum);

  const handleSave = () => {
    if (!amountNum || amountNum <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setError("");

    createIncome.mutate(
      {
        amount: amountNum,
        what_for: whatFor.trim() || null,
        sars_category: sarsCategory?.sars ?? null,
        details: details.trim() || null,
        received_from: receivedFrom.trim() || null,
        received_from_contact_id: receivedFromContactId,
        payment_method: method || null,
        transaction_date: date,
        tax_jar_amount: taxJar,
        vat_rate: isVatRegistered ? VAT_RATE : null,
        vat_amount: vatAmount,
        matched_invoice_id: matchedInvoiceId,
        account_id: accountId,
        source: "manual",
      },
      {
        onSuccess: async () => {
          // Settle the invoice only once the income row is safely saved. If
          // this fails the payment is still recorded and the invoice can be
          // marked paid by hand, which beats losing the income entry.
          if (matchedInvoiceId && markPaid && settlesInvoice) {
            await updateInvoice
              .mutateAsync({ id: matchedInvoiceId, changes: { status: "paid", paid_date: date, balance_due: 0 } })
              .catch(() => {});
          }
          onClose();
        },
      }
    );
  };

  return (
    <Modal title="Log income" onClose={onClose}>
      <Field label="Amount">
        <Input value={amount} onChange={setAmount} type="number" placeholder="0.00" autoFocus />
      </Field>

      <div style={{ position: "relative" }}>
        <Field label="What for?">
          <Input
            value={whatFor}
            onChange={(v) => {
              setWhatFor(v);
              setShowSarsSuggestions(true);
              setSarsCategory(null);
            }}
            placeholder="e.g. Gate fix, braai catering"
          />
        </Field>
        {showSarsSuggestions && (
          <SarsSuggestionDropdown
            suggestions={getSarsIncomeMatch(whatFor)}
            onPick={(s) => {
              setSarsCategory(s);
              setWhatFor(s.label);
              setShowSarsSuggestions(false);
            }}
          />
        )}
      </div>

      <ContactPicker
        label="Received from"
        value={receivedFrom}
        onChange={(v, id) => {
          setReceivedFrom(v);
          setReceivedFromContactId(id);
        }}
        contacts={contacts ?? []}
        placeholder="Name (optional)"
      />

      <InvoiceMatcher
        invoices={invoices ?? []}
        matchedId={matchedInvoiceId}
        onMatch={(id) => {
          setMatchedInvoiceId(id);
          // Default to marking paid when they pick an invoice; the matcher only
          // shows the option when the payment actually covers it.
          setMarkPaid(!!id);
        }}
        filterByClient={receivedFrom}
        onAutoFillClient={(client) => {
          if (!receivedFrom.trim()) setReceivedFrom(client);
        }}
        paymentAmount={amountNum}
        markPaid={markPaid}
        onMarkPaidChange={setMarkPaid}
      />

      <PaymentMethodPicker selected={method} onSelect={setMethod} />

      {(accounts?.length ?? 0) > 0 && <BankAccountPicker value={accountId} onChange={setAccountId} />}

      <Field label="Date">
        <Input value={date} onChange={setDate} type="date" />
      </Field>

      <Field label="Details (optional)">
        <Input value={details} onChange={setDetails} placeholder="Extra description" />
      </Field>

      {amountNum > 0 && isVatRegistered && (
        <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "12px 14px", marginBottom: 10, fontSize: 12, color: "#0C4A6E", lineHeight: 1.6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Received</span>
            <span style={{ fontWeight: 700 }}>{fmt(amountNum)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{`VAT included (${(VAT_RATE * 100).toFixed(0)}%)`}</span>
            <span style={{ fontWeight: 700 }}>−{fmt(vatAmount)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #BAE6FD", marginTop: 6, paddingTop: 6 }}>
            <span style={{ fontWeight: 700 }}>Your income</span>
            <span style={{ fontWeight: 800 }}>{fmt(netAmount)}</span>
          </div>
          <div style={{ fontSize: 11, color: "#0369A1", marginTop: 6 }}>
            The VAT is SARS&apos;s — it goes on your VAT201, not your profit.
          </div>
        </div>
      )}

      {amountNum > 0 && (
        <div style={{ background: "#F0F9FF", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#0369A1" }}>
          {`🏦 ${fmt(taxJar)} set aside for SARS (${(TAX_JAR_RATE * 100).toFixed(0)}% tax jar${isVatRegistered ? " on your income after VAT" : ""})`}
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={createIncome.isPending ? "Saving..." : "Log income"} onClick={handleSave} disabled={createIncome.isPending} />
    </Modal>
  );
}
