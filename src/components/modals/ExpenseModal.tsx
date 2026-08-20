"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { ContactPicker } from "@/components/ui/ContactPicker";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";
import { SarsSuggestionDropdown } from "@/components/ui/SarsSuggestionDropdown";
import { LedgerEntryMatcher, paymentSettlesEntry } from "@/components/ui/LedgerEntryMatcher";
import { SupplierInvoiceMatcher, expenseSettlesSupplierInvoice } from "@/components/ui/SupplierInvoiceMatcher";
import { getSarsMatch, EXPENSE_PAYMENT_METHODS, narrowMethodsForAccount, type SarsCategory } from "@/lib/sarsCategories";
import { todayStr } from "@/lib/format";
import { useCreateExpense } from "@/lib/supabase/hooks/useExpenses";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useLedgerEntries, useUpdateLedgerEntry } from "@/lib/supabase/hooks/useLedger";
import { useSupplierInvoices, useUpdateSupplierInvoice } from "@/lib/supabase/hooks/useSupplierInvoices";
import { useBankAccounts } from "@/lib/supabase/hooks/useBankAccounts";
import { BankAccountPicker } from "@/components/ui/BankAccountPicker";

export function ExpenseModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [whatFor, setWhatFor] = useState("");
  const [sarsCategory, setSarsCategory] = useState<SarsCategory | null>(null);
  const [showSarsSuggestions, setShowSarsSuggestions] = useState(false);
  const [paidTo, setPaidTo] = useState("");
  const [paidToContactId, setPaidToContactId] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [method, setMethod] = useState("Cash");
  const [date, setDate] = useState(todayStr());
  const [matchedLedgerEntryId, setMatchedLedgerEntryId] = useState<string | null>(null);
  const [markPaid, setMarkPaid] = useState(false);
  const [matchedSupplierInvoiceId, setMatchedSupplierInvoiceId] = useState<string | null>(null);
  const [markSiPaid, setMarkSiPaid] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [isPersonal, setIsPersonal] = useState(false);
  const [hasReceipt, setHasReceipt] = useState(false);
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const { data: ledgerEntries } = useLedgerEntries();
  const { data: supplierInvoices } = useSupplierInvoices();
  const createExpense = useCreateExpense();
  const updateLedgerEntry = useUpdateLedgerEntry();
  const updateSupplierInvoice = useUpdateSupplierInvoice();
  const { data: accounts } = useBankAccounts();

  // Default new entries to the business's default account, once.
  const didInitAccount = useRef(false);
  useEffect(() => {
    if (!didInitAccount.current && accounts) {
      didInitAccount.current = true;
      setAccountId(accounts.find((a) => a.is_default)?.id ?? null);
    }
  }, [accounts]);

  const amountNum = parseFloat(amount) || 0;

  // Supplier entries only: a client entry is money owed TO the business, which
  // an expense can never settle. Settled entries stay listed so an older
  // payment can still be linked, exactly as the invoice matcher does.
  const supplierEntries = (ledgerEntries ?? []).filter((e) => e.ledger_type === "supplier");
  const matchedEntry = supplierEntries.find((e) => e.id === matchedLedgerEntryId) ?? null;
  const settlesEntry = paymentSettlesEntry(matchedEntry, amountNum);

  const matchedSi = (supplierInvoices ?? []).find((si) => si.id === matchedSupplierInvoiceId) ?? null;
  const settlesSi = expenseSettlesSupplierInvoice(matchedSi, amountNum);

  // Linked to a bill (a ledger credit or a supplier invoice)? Then that document
  // is the record — it carries the category and any VAT — so the "what for" step
  // is skipped, exactly like the income side.
  const isMatched = !!(matchedLedgerEntryId || matchedSupplierInvoiceId);

  // Tagging the entry to an account narrows the payment methods to what that
  // account can do; the chosen method is kept if it still fits, otherwise the
  // display falls back to the first option — derived, not stored, so switching
  // accounts never cascades or silently loses a still-valid choice.
  const selectedAccount = (accounts ?? []).find((a) => a.id === accountId) ?? null;
  const paymentMethods = narrowMethodsForAccount(EXPENSE_PAYMENT_METHODS, selectedAccount?.account_type ?? null);
  const effectiveMethod = paymentMethods.includes(method) ? method : (paymentMethods[0] ?? "");

  const handleSave = () => {
    if (!amountNum || amountNum <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setError("");

    createExpense.mutate(
      {
        amount: amountNum,
        // A matched expense is described by the bill it settles, so its own
        // "what for" / category would duplicate that and stay null. In Profit &
        // Loss the matched cash is netted out and the bill carries the cost, so
        // nothing is lost by not categorising the payment itself.
        what_for: isMatched ? null : whatFor.trim() || null,
        sars_category: isPersonal || isMatched ? null : sarsCategory?.sars ?? null,
        details: details.trim() || null,
        paid_to: paidTo.trim() || null,
        paid_to_contact_id: paidToContactId,
        payment_method: effectiveMethod || null,
        transaction_date: date,
        // Owner's drawing — not a business expense, so it's not categorised and
        // P&L excludes it (see pnl.ts); any matcher link is dropped.
        matched_ledger_entry_id: isPersonal ? null : matchedLedgerEntryId,
        matched_supplier_invoice_id: isPersonal ? null : matchedSupplierInvoiceId,
        account_id: accountId,
        source: "manual",
        is_personal: isPersonal,
        // Only a claimed business cost needs proof. Money the owner took out
        // isn't claimed against anything, so the answer is dropped with the rest
        // of the business framing rather than saved as a stale true.
        has_receipt: isPersonal ? false : hasReceipt,
      },
      {
        onSuccess: async () => {
          // Re-check the settle rather than trusting the checkbox alone: the
          // amount can be edited after ticking it, and marking a R5,000 debt
          // settled because someone paid R50 is the kind of wrong that only
          // shows up at year end. The expense is saved either way — the link is
          // what keeps the report right, and this is only the convenience on
          // top, so a failure here must not lose the expense.
          if (matchedLedgerEntryId && markPaid && settlesEntry) {
            await updateLedgerEntry
              .mutateAsync({ id: matchedLedgerEntryId, changes: { status: "paid", paid_date: date } })
              .catch(() => {});
          }
          // Same for a supplier invoice: settling it zeroes the balance and
          // stamps paid_amount, so what-you-owe views stop listing it. paid_amount
          // is the ex-VAT invoice_amount, matching the actions modal's Mark Paid.
          if (matchedSupplierInvoiceId && markSiPaid && settlesSi && matchedSi) {
            await updateSupplierInvoice
              .mutateAsync({
                id: matchedSupplierInvoiceId,
                changes: { status: "paid", paid_date: date, paid_amount: matchedSi.invoice_amount, balance_due: 0 },
              })
              .catch(() => {});
          }
          onClose();
        },
      }
    );
  };

  return (
    <Modal title="Log expense" onClose={onClose}>
      {/* Same order as Log income, for the same reason: how much, when, whose
          money it is, who it went to, where from and how, what it settles, and
          only then what it was for. The personal question sits third because it
          decides whether any of the business steps below apply at all. */}
      <Field label="Amount (R)">
        <Input value={amount} onChange={setAmount} type="number" placeholder="0.00" autoFocus />
      </Field>

      <Field label="Date">
        <Input value={date} onChange={setDate} type="date" />
      </Field>

      <button
        type="button"
        aria-pressed={isPersonal}
        onClick={() => setIsPersonal((p) => !p)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          textAlign: "left",
          padding: "12px 14px",
          borderRadius: 12,
          border: `1.5px solid ${isPersonal ? "#0C4A6E" : "#e2e8f0"}`,
          background: isPersonal ? "#F0F9FF" : "#fff",
          cursor: "pointer",
          fontFamily: "inherit",
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1.25, flexShrink: 0, color: isPersonal ? "#0C4A6E" : "#94a3b8" }}>
          {isPersonal ? "☑" : "☐"}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: isPersonal ? "#0C4A6E" : "#334155", marginBottom: 3 }}>
            This is personal money, not a business expense
          </span>
          <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "#64748b", lineHeight: 1.5 }}>
            e.g. money you take out of the business for yourself (drawings). Kept separate from business totals &amp; tax.
          </span>
        </span>
      </button>

      <ContactPicker
        label="Paid to - Supplier"
        value={paidTo}
        onChange={(v, id) => {
          setPaidTo(v);
          setPaidToContactId(id);
        }}
        contacts={contacts ?? []}
        placeholder="Type a name or pick from your suppliers"
      />

      {/* Where it came out of and how it was paid, together — the account narrows
          the methods to what it can physically do. */}
      {(accounts?.length ?? 0) > 0 && <BankAccountPicker value={accountId} onChange={setAccountId} />}

      <PaymentMethodPicker selected={effectiveMethod} onSelect={setMethod} methods={paymentMethods} />

      {!isPersonal && (<>
      {/* Matching leads — a matched expense takes its category from the bill, so
          "what for" only shows for an unmatched spend. */}
      <LedgerEntryMatcher
        entries={supplierEntries}
        matchedId={matchedLedgerEntryId}
        onMatch={(id) => {
          setMatchedLedgerEntryId(id);
          if (!id) setMarkPaid(false);
          // Linking a bill makes it the record — drop any half-started category.
          if (id) {
            setWhatFor("");
            setSarsCategory(null);
            setShowSarsSuggestions(false);
          }
        }}
        filterByParty={paidTo}
        onAutoFillParty={setPaidTo}
        paymentAmount={amountNum}
        markPaid={markPaid}
        onMarkPaidChange={setMarkPaid}
      />

      <SupplierInvoiceMatcher
        invoices={supplierInvoices ?? []}
        matchedId={matchedSupplierInvoiceId}
        onMatch={(id) => {
          setMatchedSupplierInvoiceId(id);
          if (!id) setMarkSiPaid(false);
          if (id) {
            setWhatFor("");
            setSarsCategory(null);
            setShowSarsSuggestions(false);
          }
        }}
        filterByParty={paidTo}
        onAutoFillParty={setPaidTo}
        expenseAmount={amountNum}
        markPaid={markSiPaid}
        onMarkPaidChange={setMarkSiPaid}
      />
      </>)}

      {/* Unmatched spend: no bill to inherit from, so capture what it was for.
          Hidden for personal money (owner's drawing — not a business expense). */}
      {!isMatched && !isPersonal && (
        <div style={{ position: "relative" }}>
          <Field label="What for?">
            <Input
              value={whatFor}
              onChange={(v) => {
                setWhatFor(v);
                setShowSarsSuggestions(true);
                setSarsCategory(null);
              }}
              placeholder="e.g. Fuel at Engen, cement"
            />
          </Field>
          {showSarsSuggestions && (
            <SarsSuggestionDropdown
              suggestions={getSarsMatch(whatFor)}
              onPick={(s) => {
                setSarsCategory(s);
                setWhatFor(s.label);
                setShowSarsSuggestions(false);
              }}
            />
          )}
        </div>
      )}

      {/* Asked here, next to the claim it backs, and only for a business cost —
          a drawing is not claimed against anything, so there is nothing to prove.
          Nothing is uploaded: the answer alone is what makes a missing slip
          findable a year later, when nobody remembers which ones they kept. */}
      {!isPersonal && (
        <button
          type="button"
          aria-pressed={hasReceipt}
          onClick={() => setHasReceipt((p) => !p)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            textAlign: "left",
            padding: "12px 14px",
            borderRadius: 12,
            border: `1.5px solid ${hasReceipt ? "#0C4A6E" : "#e2e8f0"}`,
            background: hasReceipt ? "#F0F9FF" : "#fff",
            cursor: "pointer",
            fontFamily: "inherit",
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1.25, flexShrink: 0, color: hasReceipt ? "#0C4A6E" : "#94a3b8" }}>
            {hasReceipt ? "☑" : "☐"}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: hasReceipt ? "#0C4A6E" : "#334155", marginBottom: 3 }}>
              I have a receipt or proof for this
            </span>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "#64748b", lineHeight: 1.5 }}>
              SARS can ask for proof of any expense you claim. It does not need to be uploaded — just keep it somewhere safe.
            </span>
          </span>
        </button>
      )}

      <Field label="Details - optional">
        <Input value={details} onChange={setDetails} placeholder="Type any extra details" />
      </Field>

      {/* No bill matched and no account tagged — the entry has nothing to
          reconcile against. A non-blocking nudge to give it a home. */}
      {!isMatched && !isPersonal && !accountId && amountNum > 0 && (accounts?.length ?? 0) > 0 && (
        <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
          ⚠️ This isn&apos;t linked to a bill or a bank account — tag the account it was paid from so it reconciles against your statement later.
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={createExpense.isPending ? "Saving..." : "Log expense"} onClick={handleSave} disabled={createExpense.isPending} />
    </Modal>
  );
}
