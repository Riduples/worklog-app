"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Row } from "@/components/ui/Row";
import { InvoiceMatcher, paymentSettlesInvoice } from "@/components/ui/InvoiceMatcher";
import { fmt, todayStr } from "@/lib/format";
import { useTaxRates } from "@/lib/taxRates";
import { parseQuickLog, fileToBase64, type QuickLogAction, type QuickLogDraft, type QuickLogImage } from "@/lib/quickLog";
import { useCreateIncome } from "@/lib/supabase/hooks/useIncome";
import { useInvoices, useUpdateInvoice } from "@/lib/supabase/hooks/useInvoices";
import { useCreateExpense } from "@/lib/supabase/hooks/useExpenses";
import { useCreateBooking } from "@/lib/supabase/hooks/useBookings";
import { useCreateStockItem } from "@/lib/supabase/hooks/useStock";
import { useCreateMileageTrip } from "@/lib/supabase/hooks/useMileage";
import { useCreateTimeEntry } from "@/lib/supabase/hooks/useTimeEntries";
import { useCreateContact } from "@/lib/supabase/hooks/useContacts";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useBankAccounts } from "@/lib/supabase/hooks/useBankAccounts";
import { BankAccountPicker } from "@/components/ui/BankAccountPicker";

const EXAMPLES = [
  "R450 cash from Thabo for the gate fix",
  "Bought R200 fuel at Engen, paid card",
  "Book Sarah for Friday 2pm, braai catering R1500",
  "Add 20 bags cement at R80 each",
  "Drove 45km to Sandton for a site visit",
  "3 hours plumbing for Mrs Khumalo",
];

// Header shown on the confirm card, per action.
const ACTION_META: Record<QuickLogAction, { icon: string; label: string }> = {
  income: { icon: "💰", label: "Income detected" },
  expense: { icon: "💸", label: "Expense detected" },
  booking: { icon: "📅", label: "Booking detected" },
  stock: { icon: "📦", label: "Stock item detected" },
  mileage: { icon: "🚗", label: "Trip detected" },
  time: { icon: "⏱️", label: "Time entry detected" },
  contact: { icon: "👥", label: "New contact detected" },
  handoff: { icon: "🧭", label: "Needs a full tool" },
};

// Where "handoff" sends the user — the tools Quick Log can't complete in one step.
const HANDOFF_TOOLS: Record<string, { label: string; href: string }> = {
  invoice: { label: "Invoices", href: "/invoices" },
  quote: { label: "Quotes", href: "/quotes" },
  purchaseorder: { label: "Purchase Orders", href: "/purchase-orders" },
  supplierinvoice: { label: "Supplier Invoices", href: "/supplier-invoices" },
  statement: { label: "Statements", href: "/statement" },
  payroll: { label: "Pay Run", href: "/payroll" },
  staff: { label: "Staff Register", href: "/staff" },
  tax: { label: "Tax & SARS", href: "/tax" },
};

// Only the field with no sensible default blocks a save; dates fall back to today.
function validateDraft(d: QuickLogDraft): string | null {
  switch (d.action) {
    case "income":
    case "expense":
      return d.amount == null
        ? 'I couldn\'t find a clear amount. Add the rand amount, e.g. "R450 cash from Thabo".'
        : null;
    case "booking":
      return !d.person.trim() ? 'Who is the booking for? Add a name, e.g. "Book Sarah for Friday 2pm".' : null;
    case "stock":
      return !d.whatFor.trim() ? 'What item is this? e.g. "Add 20 bags cement at R80".' : null;
    case "mileage":
      return d.km == null ? 'How far was the trip? Add the distance, e.g. "Drove 45km to Sandton".' : null;
    case "time":
      return d.hours == null ? 'How many hours? e.g. "3 hours plumbing for Mrs Khumalo".' : null;
    case "contact":
      return !d.person.trim() ? "What's the contact's name?" : null;
    case "handoff":
      return null;
  }
}

type HistoryEntry = { role: "user" | "assistant"; text: string };

export function QuickLogModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
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

  const { TAX_JAR_RATE, VAT_RATE, MILEAGE_RATE, vatFromGross } = useTaxRates();
  const createIncome = useCreateIncome();
  const createExpense = useCreateExpense();
  const createBooking = useCreateBooking();
  const createStock = useCreateStockItem();
  const createMileage = useCreateMileageTrip();
  const createTime = useCreateTimeEntry();
  const createContact = useCreateContact();
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
  const draftVat = draft?.action === "income" && isVatRegistered ? vatFromGross(draft.amount ?? 0, VAT_RATE) : 0;
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
      const problem = validateDraft(result);
      if (problem) {
        setError(problem);
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

  // Clears the confirm card and the input for the next entry. Deliberately keeps
  // accountId — logging a run of entries from one account is the common case.
  const resetAfterEntry = () => {
    setDraft(null);
    setMatchedInvoiceId(null);
    setMarkPaid(false);
    setText("");
    setImageData(null);
    setImagePreview(null);
  };

  const confirmAndSave = () => {
    if (!draft) return;

    const onSaved = (msg: string) => {
      setHistory((h) => [...h, { role: "assistant", text: msg }]);
      resetAfterEntry();
    };

    switch (draft.action) {
      case "income": {
        if (draft.amount == null) return;
        const amount = draft.amount;
        const settledDoc = markPaid && settlesInvoice ? matchedInvoice?.doc_number : null;
        const onIncomeSuccess = async () => {
          // Settle only after the income row is saved: if this fails the payment is
          // still recorded and the invoice can be marked paid by hand, which beats
          // losing the entry.
          if (matchedInvoiceId && markPaid && settlesInvoice) {
            await updateInvoice
              .mutateAsync({ id: matchedInvoiceId, changes: { status: "paid", paid_date: todayStr(), balance_due: 0 } })
              .catch(() => {});
          }
          onSaved(`✅ Logged income of ${fmt(amount)}${settledDoc ? ` · ${settledDoc} marked paid` : ""}`);
        };
        createIncome.mutate(
          {
            amount,
            what_for: draft.whatFor || null,
            received_from: draft.person || null,
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
        break;
      }
      case "expense": {
        if (draft.amount == null) return;
        const amount = draft.amount;
        createExpense.mutate(
          {
            amount,
            what_for: draft.whatFor || null,
            paid_to: draft.person || null,
            payment_method: draft.method || null,
            transaction_date: todayStr(),
            account_id: accountId,
            source: "quick_log",
          },
          { onSuccess: () => onSaved(`✅ Logged expense of ${fmt(amount)}`) }
        );
        break;
      }
      case "booking": {
        const price = draft.amount ?? 0;
        createBooking.mutate(
          {
            client_name: draft.person,
            service: draft.whatFor || null,
            booking_date: draft.date || todayStr(),
            booking_time: draft.time || null,
            total_price: price,
            // Nothing paid yet, so the whole price is still due.
            balance_due: price,
          },
          { onSuccess: () => onSaved(`📅 Booking for ${draft.person} saved`) }
        );
        break;
      }
      case "stock": {
        createStock.mutate(
          {
            name: draft.whatFor,
            qty: Math.round(draft.quantity ?? 0),
            cost_price: draft.amount ?? 0,
          },
          { onSuccess: () => onSaved(`📦 Added ${draft.whatFor} to stock`) }
        );
        break;
      }
      case "mileage": {
        const km = draft.km ?? 0;
        // Quick Log only gets the distance, but the table needs odometer readings,
        // so record a 0→km span — end minus start stays equal to km_travelled.
        createMileage.mutate(
          {
            odometer_start: 0,
            odometer_end: km,
            km_travelled: km,
            trip_date: draft.date || todayStr(),
            purpose: draft.whatFor || null,
            trip_type: "Business",
            sars_deduction: km * MILEAGE_RATE,
          },
          { onSuccess: () => onSaved(`🚗 Logged ${km}km trip`) }
        );
        break;
      }
      case "time": {
        const hours = draft.hours ?? 0;
        createTime.mutate(
          {
            hours_worked: hours,
            entry_date: draft.date || todayStr(),
            client_name: draft.person || null,
            description: draft.whatFor || null,
            bill_type: "Billable",
          },
          { onSuccess: () => onSaved(`⏱️ Logged ${hours}h${draft.person ? ` for ${draft.person}` : ""}`) }
        );
        break;
      }
      case "contact": {
        const type = draft.contactType === "supplier" ? "supplier" : "client";
        createContact.mutate(
          {
            name: draft.person,
            contact_type: type,
            phone: draft.phone || null,
          },
          { onSuccess: () => onSaved(`👥 Saved ${draft.person}`) }
        );
        break;
      }
      case "handoff":
        break; // handled by its own card's button
    }
  };

  const openHandoff = () => {
    if (!draft) return;
    const dest = HANDOFF_TOOLS[draft.suggestedTool] ?? { label: "Worklog", href: "/dashboard" };
    router.push(dest.href);
    onClose();
  };

  const saving =
    createIncome.isPending ||
    createExpense.isPending ||
    createBooking.isPending ||
    createStock.isPending ||
    createMileage.isPending ||
    createTime.isPending ||
    createContact.isPending;

  const meta = draft ? ACTION_META[draft.action] : null;
  const handoffDest = draft?.action === "handoff" ? HANDOFF_TOOLS[draft.suggestedTool] ?? { label: "Worklog", href: "/dashboard" } : null;

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
        <span style={{ fontWeight: 700 }}>✨ Quick Log</span> — Tell Worklog what happened in any way that works for you.
        Log money in or out, a booking, stock, a trip, hours or a new contact — type it, say it, or snap a photo. Worklog
        reads it and logs it for you to confirm.
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

      {draft && draft.action === "handoff" && handoffDest && meta && (
        <div style={{ background: "#fff", border: "2px solid #F59E0B", borderRadius: 16, padding: 18, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>{meta.icon}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#92400e" }}>Better in the {handoffDest.label} tool</span>
          </div>
          <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: "0 0 16px" }}>
            That&apos;s something the <strong>{handoffDest.label}</strong> tool handles properly — it needs a few more
            details than a quick note. Want to open it now?
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={resetAfterEntry}
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
              Not now
            </button>
            <button
              onClick={openHandoff}
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
              Open {handoffDest.label} →
            </button>
          </div>
        </div>
      )}

      {draft && draft.action !== "handoff" && meta && (
        <div style={{ background: "#fff", border: "2px solid #F59E0B", borderRadius: 16, padding: 18, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 20 }}>{meta.icon}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#92400e" }}>{meta.label}</span>
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

          {(draft.action === "income" || draft.action === "expense") && (
            <>
              <Row label="Amount" value={fmt(draft.amount ?? 0)} bold />
              <Row label="What for" value={draft.whatFor || "—"} />
              <Row label={draft.action === "income" ? "From" : "To"} value={draft.person || "—"} />
              <Row label="Method" value={draft.method || "—"} />
              {draft.action === "income" && isVatRegistered && (
                <>
                  <Row label={`VAT included (${(VAT_RATE * 100).toFixed(0)}%)`} value={`−${fmt(draftVat)}`} />
                  <Row label="Your income" value={fmt(draftNet)} bold />
                </>
              )}
              {draft.action === "income" && (
                <Row label={`Tax jar (${Math.round(TAX_JAR_RATE * 100)}%)`} value={fmt(draftNet * TAX_JAR_RATE)} />
              )}
              {/* Quick Log income needs the same invoice link as the Income modal:
                  without it, logging a payment for an invoice already issued
                  double-counts the revenue on Profit & Loss. */}
              {draft.action === "income" && (
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
            </>
          )}

          {draft.action === "booking" && (
            <>
              <Row label="Client" value={draft.person || "—"} bold />
              {draft.whatFor && <Row label="Service" value={draft.whatFor} />}
              <Row label="Date" value={draft.date || todayStr()} />
              {draft.time && <Row label="Time" value={draft.time} />}
              {draft.amount != null && draft.amount > 0 && <Row label="Price" value={fmt(draft.amount)} />}
            </>
          )}

          {draft.action === "stock" && (
            <>
              <Row label="Item" value={draft.whatFor || "—"} bold />
              <Row label="Quantity" value={String(Math.round(draft.quantity ?? 0))} />
              {draft.amount != null && draft.amount > 0 && <Row label="Cost price (each)" value={fmt(draft.amount)} />}
            </>
          )}

          {draft.action === "mileage" && (
            <>
              <Row label="Distance" value={`${draft.km ?? 0} km`} bold />
              {draft.whatFor && <Row label="Purpose" value={draft.whatFor} />}
              <Row label="Date" value={draft.date || todayStr()} />
              <Row label={`SARS deduction (R${MILEAGE_RATE.toFixed(2)}/km)`} value={fmt((draft.km ?? 0) * MILEAGE_RATE)} />
            </>
          )}

          {draft.action === "time" && (
            <>
              <Row label="Hours" value={String(draft.hours ?? 0)} bold />
              {draft.person && <Row label="Client" value={draft.person} />}
              {draft.whatFor && <Row label="Work done" value={draft.whatFor} />}
              <Row label="Date" value={draft.date || todayStr()} />
            </>
          )}

          {draft.action === "contact" && (
            <>
              <Row label="Name" value={draft.person || "—"} bold />
              <Row label="Type" value={draft.contactType === "supplier" ? "Supplier" : "Client"} />
              {draft.phone && <Row label="Phone" value={draft.phone} />}
            </>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              onClick={resetAfterEntry}
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
