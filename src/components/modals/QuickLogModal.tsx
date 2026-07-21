"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Row } from "@/components/ui/Row";
import { InvoiceMatcher, paymentSettlesInvoice } from "@/components/ui/InvoiceMatcher";
import { fmt, todayStr } from "@/lib/format";
import { useTaxRates } from "@/lib/taxRates";
import { parseQuickLog, fileToBase64, type QuickLogDraft, type QuickLogImage } from "@/lib/quickLog";
import { useCreateIncome } from "@/lib/supabase/hooks/useIncome";
import { useInvoices, useUpdateInvoice } from "@/lib/supabase/hooks/useInvoices";
import { useCreateExpense } from "@/lib/supabase/hooks/useExpenses";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useBankAccounts } from "@/lib/supabase/hooks/useBankAccounts";
import { BankAccountPicker } from "@/components/ui/BankAccountPicker";

const EXAMPLES = [
  "R450 cash from Thabo for the gate fix",
  "Bought R200 fuel at Engen, paid card",
  "Got R1200 EFT from Sarah, deposit for braai catering",
  "Paid R350 to John's Hardware for cement, cash",
];

type HistoryEntry = { role: "user" | "assistant"; text: string };

export function QuickLogModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [imageData, setImageData] = useState<QuickLogImage | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<QuickLogDraft | null>(null);
  const [matchedInvoiceId, setMatchedInvoiceId] = useState<string | null>(null);
  const [markPaid, setMarkPaid] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { TAX_JAR_RATE, VAT_RATE, vatFromGross } = useTaxRates();
  const createIncome = useCreateIncome();
  const createExpense = useCreateExpense();
  const { data: invoices } = useInvoices();
  const { data: business } = useBusinessProfile();
  const { data: accounts } = useBankAccounts();
  const updateInvoice = useUpdateInvoice();

  // Default to the business's default account, once. It persists across entries
  // (the modal stays open), which suits logging a run from the same account.
  const didInitAccount = useRef(false);
  useEffect(() => {
    if (!didInitAccount.current && accounts) {
      didInitAccount.current = true;
      setAccountId(accounts.find((a) => a.is_default)?.id ?? null);
    }
  }, [accounts]);

  // Quick Log amounts are what the user says arrived, so VAT is inside them.
  const isVatRegistered = !!business?.vat_number;
  const draftVat = draft?.type === "income" && isVatRegistered ? vatFromGross(draft.amount ?? 0, VAT_RATE) : 0;
  const draftNet = (draft?.amount ?? 0) - draftVat;

  const matchedInvoice = (invoices ?? []).find((i) => i.id === matchedInvoiceId) ?? null;
  const settlesInvoice = paymentSettlesInvoice(matchedInvoice, draft?.amount ?? 0);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Voice input is not supported on this browser. Try Chrome or Safari.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-ZA";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setText(transcript);
      setListening(false);
    };
    recognition.onerror = () => {
      setError("Couldn't hear that clearly. Try again or type it instead.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  const handleImage = async (file: File | undefined) => {
    if (!file) return;
    const data = await fileToBase64(file);
    setImageData(data);
    setImagePreview(`data:${data.mediaType};base64,${data.base64}`);
  };

  const handleSubmit = async () => {
    if ((!text.trim() && !imageData) || loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await parseQuickLog({ text: text.trim() || undefined, image: imageData ?? undefined });
      if (result.amount == null) {
        setError('I couldn\'t find a clear amount. Try adding the rand amount, e.g. "R450 cash from Thabo".');
        return;
      }
      setDraft(result);
      setHistory((h) => [...h, { role: "user", text: imageData ? "📷 Photo/document uploaded" : text.trim() }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that — please try again or type it manually.");
    } finally {
      setLoading(false);
    }
  };

  const confirmAndSave = () => {
    if (!draft || draft.amount == null) return;
    const amount = draft.amount;
    const whatFor = draft.whatFor || null;
    const person = draft.person || null;

    const settledDoc = markPaid && settlesInvoice ? matchedInvoice?.doc_number : null;

    const onSuccess = () => {
      setHistory((h) => [
        ...h,
        {
          role: "assistant",
          text: `✅ Logged ${draft.type} of ${fmt(amount)}${settledDoc ? ` · ${settledDoc} marked paid` : ""}`,
        },
      ]);
      setDraft(null);
      // Clear the link too — the modal stays open for the next entry, and a
      // stale match would silently attach it to the previous invoice.
      setMatchedInvoiceId(null);
      setMarkPaid(false);
      setText("");
      setImageData(null);
      setImagePreview(null);
    };

    const onIncomeSuccess = async () => {
      // Settle only after the income row is saved: if this fails the payment is
      // still recorded and the invoice can be marked paid by hand, which beats
      // losing the entry.
      if (matchedInvoiceId && markPaid && settlesInvoice) {
        await updateInvoice
          .mutateAsync({ id: matchedInvoiceId, changes: { status: "paid", paid_date: todayStr(), balance_due: 0 } })
          .catch(() => {});
      }
      onSuccess();
    };

    if (draft.type === "income") {
      createIncome.mutate(
        {
          amount,
          what_for: whatFor,
          received_from: person,
          payment_method: draft.method || null,
          transaction_date: todayStr(),
          // Provision on income after VAT — the VAT portion is SARS's, not the
          // business's, so provisioning on the gross would over-save.
          tax_jar_amount: draftNet * TAX_JAR_RATE,
          vat_rate: isVatRegistered ? VAT_RATE : null,
          vat_amount: draftVat,
          matched_invoice_id: matchedInvoiceId,
          account_id: accountId,
          source: "quick_log",
        },
        { onSuccess: onIncomeSuccess }
      );
    } else {
      createExpense.mutate(
        {
          amount,
          what_for: whatFor,
          paid_to: person,
          payment_method: draft.method || null,
          transaction_date: todayStr(),
          account_id: accountId,
          source: "quick_log",
        },
        { onSuccess }
      );
    }
  };

  const discardDraft = () => {
    setDraft(null);
    setMatchedInvoiceId(null);
    setMarkPaid(false);
    setText("");
    setImageData(null);
    setImagePreview(null);
  };

  const saving = createIncome.isPending || createExpense.isPending;

  return (
    <Modal title="Quick Log" onClose={onClose}>
      <div
        style={{
          background: "#fffbeb",
          border: "1.5px solid #fde68a",
          borderRadius: 12,
          padding: "12px 14px",
          marginBottom: 18,
          fontSize: 12,
          color: "#92400e",
          lineHeight: 1.5,
        }}
      >
        <span style={{ fontWeight: 700 }}>✨ Quick Log</span> — Tell Worklog what happened in any way that works for
        you. Type it, say it, or snap a photo of the receipt — Worklog reads it and logs it for you to confirm.
      </div>

      {history.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {history.map((h, idx) => (
            <div
              key={idx}
              style={{
                background: h.role === "user" ? "#f8fafc" : "#fffbeb",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 8,
                fontSize: 13,
                color: h.role === "user" ? "#374151" : "#92400e",
                fontWeight: h.role === "assistant" ? 600 : 400,
              }}
            >
              {h.role === "user" ? `💬 "${h.text}"` : h.text}
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div style={{ background: "#fff", border: "2px solid #F59E0B", borderRadius: 16, padding: 18, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 20 }}>{draft.type === "income" ? "💰" : "💸"}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#92400e" }}>
              {draft.type === "income" ? "Income detected" : "Expense detected"}
            </span>
            {draft.confidence === "low" && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#b45309",
                  background: "#fff7ed",
                  padding: "3px 8px",
                  borderRadius: 10,
                }}
              >
                ⚠️ double-check
              </span>
            )}
          </div>
          <Row label="Amount" value={fmt(draft.amount ?? 0)} bold />
          <Row label="What for" value={draft.whatFor || "—"} />
          <Row label={draft.type === "income" ? "From" : "To"} value={draft.person || "—"} />
          <Row label="Method" value={draft.method || "—"} />
          {draft.type === "income" && isVatRegistered && (
            <>
              <Row label={`VAT included (${(VAT_RATE * 100).toFixed(0)}%)`} value={`−${fmt(draftVat)}`} />
              <Row label="Your income" value={fmt(draftNet)} bold />
            </>
          )}
          {draft.type === "income" && (
            <Row label={`Tax jar (${Math.round(TAX_JAR_RATE * 100)}%)`} value={fmt(draftNet * TAX_JAR_RATE)} />
          )}
          {/* Quick Log income needs the same invoice link as the Income modal:
              without it, logging a payment for an invoice already issued
              double-counts the revenue on Profit & Loss. */}
          {draft.type === "income" && (
            <div style={{ marginTop: 12 }}>
              <InvoiceMatcher
                invoices={invoices ?? []}
                matchedId={matchedInvoiceId}
                onMatch={(id) => {
                  setMatchedInvoiceId(id);
                  setMarkPaid(!!id);
                }}
                filterByClient={draft.person ?? ""}
                paymentAmount={draft.amount ?? 0}
                markPaid={markPaid}
                onMarkPaidChange={setMarkPaid}
              />
            </div>
          )}
          {(accounts?.length ?? 0) > 0 && (
            <div style={{ marginTop: 12 }}>
              <BankAccountPicker value={accountId} onChange={setAccountId} />
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              onClick={discardDraft}
              disabled={saving}
              style={{
                flex: 1,
                background: "#f1f5f9",
                border: "none",
                borderRadius: 12,
                padding: "13px",
                fontSize: 14,
                fontWeight: 700,
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              Discard
            </button>
            <button
              onClick={confirmAndSave}
              disabled={saving}
              style={{
                flex: 2,
                background: "#F59E0B",
                border: "none",
                borderRadius: 12,
                padding: "13px",
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              {saving ? "Saving..." : "✅ Confirm & Save"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#fff1f2",
            border: "1.5px solid #fecdd3",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "#be123c",
          }}
        >
          {error}
        </div>
      )}

      {!draft && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
            <button
              onClick={startListening}
              style={{
                background: "#fffbeb",
                border: "1.5px solid #fde68a",
                borderRadius: 12,
                padding: "12px 6px",
                color: "#92400e",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 3 }}>🎙️</div>
              <div style={{ fontSize: 11, fontWeight: 700 }}>Speak</div>
            </button>
            <button
              onClick={() => cameraInputRef.current?.click()}
              style={{
                background: "#fffbeb",
                border: "1.5px solid #fde68a",
                borderRadius: 12,
                padding: "12px 6px",
                color: "#92400e",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 3 }}>📷</div>
              <div style={{ fontSize: 11, fontWeight: 700 }}>Camera</div>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: "#fffbeb",
                border: "1.5px solid #fde68a",
                borderRadius: 12,
                padding: "12px 6px",
                color: "#92400e",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 3 }}>📄</div>
              <div style={{ fontSize: 11, fontWeight: 700 }}>Upload</div>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => handleImage(e.target.files?.[0])}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => handleImage(e.target.files?.[0])}
          />

          {listening && (
            <div
              style={{
                background: "#fee2e2",
                border: "1.5px solid #fecaca",
                borderRadius: 12,
                padding: "16px",
                marginBottom: 14,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>🎙️</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#be123c" }}>Listening... speak now</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                Say something like &quot;R450 cash from Thabo for the gate fix&quot;
              </div>
            </div>
          )}

          {imagePreview && (
            <div style={{ marginBottom: 14, position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Receipt"
                style={{ width: "100%", borderRadius: 12, maxHeight: 200, objectFit: "cover" }}
              />
              <button
                onClick={() => {
                  setImageData(null);
                  setImagePreview(null);
                }}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "rgba(0,0,0,0.6)",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 10px",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ✕ Remove
              </button>
              <div style={{ fontSize: 12, color: "#92400e", marginTop: 6, fontWeight: 600 }}>
                ✅ Photo ready — add any extra details below or tap Log it
              </div>
            </div>
          )}

          <Field label={imageData ? "Add extra details (optional)" : "What happened?"}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={imageData ? "e.g. This was paid by card, from Sipho..." : "e.g. R450 cash from Thabo for the gate fix"}
              rows={3}
              style={{
                width: "100%",
                padding: "13px 14px",
                borderRadius: 12,
                border: "1.5px solid #e2e8f0",
                fontSize: 15,
                boxSizing: "border-box",
                color: "#111",
                background: "#f8fafc",
                outline: "none",
                resize: "none",
                fontFamily: "inherit",
              }}
            />
          </Field>

          <button
            onClick={handleSubmit}
            disabled={(!text.trim() && !imageData) || loading}
            style={{
              width: "100%",
              background: (!text.trim() && !imageData) || loading ? "#94a3b8" : "#F59E0B",
              border: "none",
              borderRadius: 14,
              padding: "16px",
              fontSize: 16,
              fontWeight: 700,
              cursor: (!text.trim() && !imageData) || loading ? "default" : "pointer",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginBottom: 20,
            }}
          >
            {loading ? "⏳ Reading..." : "✨ Log it"}
          </button>

          {!imageData && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginBottom: 10,
                }}
              >
                Try saying something like
              </div>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setText(ex)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 12,
                    color: "#64748b",
                    marginBottom: 8,
                    cursor: "pointer",
                  }}
                >
                  &quot;{ex}&quot;
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
