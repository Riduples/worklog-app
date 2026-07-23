"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useCreateIncome } from "@/lib/supabase/hooks/useIncome";
import { useCreateExpense } from "@/lib/supabase/hooks/useExpenses";
import { useInvoices, useUpdateInvoice } from "@/lib/supabase/hooks/useInvoices";
import { useLedgerEntries, useUpdateLedgerEntry } from "@/lib/supabase/hooks/useLedger";
import { useSupplierInvoices, useUpdateSupplierInvoice } from "@/lib/supabase/hooks/useSupplierInvoices";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useBankAccounts } from "@/lib/supabase/hooks/useBankAccounts";
import { useTaxRates } from "@/lib/taxRates";
import { fmt } from "@/lib/format";
import { inPeriod } from "@/lib/period";
import { renderEncryptedPdf, pdfIsEncrypted } from "@/lib/pdf/decryptStatement";
import { matchStatementAccount, type StatementMeta } from "@/lib/accounts";
import { BackLink } from "@/components/ui/BackLink";
import { BankAccountPicker } from "@/components/ui/BankAccountPicker";
import { InvoiceMatcher, paymentSettlesInvoice } from "@/components/ui/InvoiceMatcher";
import { SupplierInvoiceMatcher, expenseSettlesSupplierInvoice } from "@/components/ui/SupplierInvoiceMatcher";
import { LedgerEntryMatcher, expenseSettlesEntry } from "@/components/ui/LedgerEntryMatcher";

type ParsedTxn = {
  date: string;
  description: string;
  type: "income" | "expense";
  amount: number;
  method: string;
  category: string;
  confidence: "high" | "low";
};

type Step = "consent" | "upload" | "processing" | "password" | "review" | "done";

// Per expense row: which supplier invoice / credit-book entry a bank payment
// settles, and whether to also mark them paid. Linking keeps the cost out of
// Profit & Loss so it isn't counted twice against the bill that already booked it.
type ExpLinks = { ledgerId: string | null; ledgerPaid: boolean; siId: string | null; siPaid: boolean };
const EMPTY_EXP: ExpLinks = { ledgerId: null, ledgerPaid: false, siId: null, siPaid: false };

// Out here, not inside the component. Declared during render it was a new
// function on every pass, so React saw a different component type each time and
// threw the subtree away rather than updating it. Harmless for a link and a
// heading — until someone puts a field in it and the focus starts jumping out
// mid-keystroke. It closes over nothing, so there was never a reason for it to
// be in there.
const Header = () => (
  <>
    <BackLink />
    <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>Import Bank Statement</h1>
  </>
);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Parse and format straight off the YYYY-MM-DD string — no Date object, so the
// SAST/UTC boundary trap can't shift a date by a day. One month → "April 2026";
// a span → "3 Apr – 28 Apr 2026".
const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${(MONTHS[(m ?? 1) - 1] ?? "").slice(0, 3)} ${y}`;
};
const rangeLabel = (from: string, to: string) => {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  if (fy === ty && fm === tm) return `${MONTHS[(fm ?? 1) - 1] ?? ""} ${fy}`;
  return `${fmtDay(from)} – ${fmtDay(to)}`;
};

// btoa needs a binary string; feed it the bytes in chunks so a large file doesn't
// blow the argument limit on String.fromCharCode.
function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function BankStatementView() {
  const createIncome = useCreateIncome();
  const createExpense = useCreateExpense();
  const { data: invoices } = useInvoices();
  const updateInvoice = useUpdateInvoice();
  const { data: ledgerEntries } = useLedgerEntries();
  const { data: supplierInvoices } = useSupplierInvoices();
  const updateLedgerEntry = useUpdateLedgerEntry();
  const updateSupplierInvoice = useUpdateSupplierInvoice();
  const { TAX_JAR_RATE, VAT_RATE, vatFromGross } = useTaxRates();
  const { data: business } = useBusinessProfile();
  const isVatRegistered = !!business?.vat_number;
  const { data: accounts } = useBankAccounts();
  // Supplier entries only — a client entry is money owed TO the business, which
  // a bank payment out can never settle.
  const supplierEntries = (ledgerEntries ?? []).filter((e) => e.ledger_type === "supplier");

  const [step, setStep] = useState<Step>("consent");
  const [fileData, setFileData] = useState<{ base64: string; mediaType: string } | null>(null);
  const [fileName, setFileName] = useState("");
  const [transactions, setTransactions] = useState<ParsedTxn[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  // Per-row: the invoice a deposit is linked to, and whether linking it also
  // marks that invoice paid. Linking is what keeps an imported payment from
  // double-counting against the invoice that already booked the revenue.
  const [matchByIndex, setMatchByIndex] = useState<Record<number, string | null>>({});
  const [markPaidByIndex, setMarkPaidByIndex] = useState<Record<number, boolean>>({});
  const [expLinksByIndex, setExpLinksByIndex] = useState<Record<number, ExpLinks>>({});
  const setExpLinks = (i: number, patch: Partial<ExpLinks>) =>
    setExpLinksByIndex((p) => ({ ...p, [i]: { ...(p[i] ?? EMPTY_EXP), ...patch } }));
  const [error, setError] = useState("");
  const [imported, setImported] = useState<{ count: number; from: string; to: string; outOfMonth: number } | null>(null);
  // Encrypted-PDF path: the raw bytes stay on the device; only the password the
  // user types (never stored, never sent) unlocks them locally.
  const [rawBytes, setRawBytes] = useState<Uint8Array | null>(null);
  const [encrypted, setEncrypted] = useState(false);
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [warning, setWarning] = useState("");
  const [importAccountId, setImportAccountId] = useState<string | null>(null);
  const [detection, setDetection] = useState<{ note: string; matched: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Which selected rows already committed, so a retry after a mid-way save failure
  // doesn't insert them a second time.
  const savedIdxRef = useRef<Set<number>>(new Set());

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setWarning("");
    setPwError("");
    setPassword("");
    setAttempts(0);
    setEncrypted(false);
    setRawBytes(null);
    setFileData(null);
    setDetection(null);
    const name = file.name || "statement";
    setFileName(name);
    const mediaType = file.type || (name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    try {
      const buf = await file.arrayBuffer();
      if (mediaType === "application/pdf") {
        const bytes = new Uint8Array(buf);
        const enc = pdfIsEncrypted(bytes);
        setRawBytes(bytes);
        setEncrypted(enc);
        // Encrypted PDFs are sent as rasterised pages, never the raw base64 — so
        // skip encoding it. fileData stays non-null as the "a file is loaded" gate.
        setFileData({ base64: enc ? "" : bufToBase64(buf), mediaType });
      } else {
        setFileData({ base64: bufToBase64(buf), mediaType });
      }
    } catch {
      setError("Couldn't read that file — try another one.");
    }
  };

  // Sends whichever shape we ended up with — a native file, or the page images we
  // rendered from a decrypted PDF — and moves to review.
  const runParse = async (
    payload: { file: { base64: string; mediaType: string } } | { pages: { base64: string; mediaType: string }[] }
  ) => {
    try {
      const res = await fetch("/api/parse-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Couldn't read the statement.");
      const txns = data.transactions as ParsedTxn[];
      const match = matchStatementAccount(data.statement as StatementMeta, accounts ?? []);
      setImportAccountId(match.accountId);
      setDetection(match.note ? { note: match.note, matched: match.matched } : null);
      setTransactions(txns);
      setSelected(Object.fromEntries(txns.map((_, i) => [i, true])));
      setMatchByIndex({});
      setMarkPaidByIndex({});
      setExpLinksByIndex({});
      savedIdxRef.current = new Set(); // fresh parse → nothing committed yet
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read the statement.");
      setStep("upload");
    }
  };

  // Unencrypted files go straight up; encrypted PDFs are unlocked + rasterised on
  // the device first, so the PDF and its password never leave the phone.
  const beginImport = async () => {
    if (!fileData) return;
    setError("");
    setWarning("");
    if (encrypted && rawBytes) {
      await unlockAndRun(undefined);
    } else {
      setStep("processing");
      await runParse({ file: fileData });
    }
  };

  const unlockAndRun = async (pw: string | undefined) => {
    if (!rawBytes) return;
    setStep("processing");
    const result = await renderEncryptedPdf(rawBytes, pw);
    if (result.status === "need-password") {
      setStep("password");
      return;
    }
    if (result.status === "wrong-password") {
      setAttempts((a) => a + 1);
      setPwError("That password didn't work. Check the email the statement came in and try again.");
      setStep("password");
      return;
    }
    if (result.status === "too-large") {
      setError(
        "This statement has too many pages to unlock at once. Try a photo of the pages you need, or split the PDF into smaller parts."
      );
      setStep("upload");
      return;
    }
    if (result.status === "failed") {
      setError(
        "We couldn't unlock this PDF on your phone. Try opening it in your banking app and re-downloading it without a password, or upload a clear photo of the statement."
      );
      setStep("upload");
      return;
    }
    setPassword(""); // unlocked — don't keep it around
    if (result.skipped > 0) {
      setWarning(
        `${result.skipped} page${result.skipped === 1 ? "" : "s"} couldn't be read on this phone and ${
          result.skipped === 1 ? "was" : "were"
        } skipped — check your records, or try a clearer photo of those pages.`
      );
    }
    await runParse({ pages: result.pages.map((b64) => ({ base64: b64, mediaType: "image/jpeg" })) });
  };

  const submitPassword = () => {
    const pw = password.trim();
    if (!pw) return;
    if (attempts >= 5) {
      setStep("upload");
      setError(
        "Too many attempts. Try opening the PDF in your banking app and re-downloading it without a password, or upload a clear photo of the statement."
      );
      return;
    }
    setPwError("");
    void unlockAndRun(pw);
  };

  const saveSelected = async () => {
    const toSave = transactions.map((t, i) => ({ t, i })).filter(({ i }) => selected[i]);
    setError("");
    try {
      for (const { t, i } of toSave) {
        if (savedIdxRef.current.has(i)) continue; // already committed on an earlier attempt
        if (t.type === "income") {
          // A bank statement only ever shows the gross amount that landed, so
          // any VAT is inside it and has to be extracted rather than added.
          const vatAmount = isVatRegistered ? vatFromGross(t.amount, VAT_RATE) : 0;
          const net = t.amount - vatAmount;
          // Linking a deposit to the invoice it settles is what stops Profit &
          // Loss (and VAT201) counting the same money twice — the invoice already
          // booked the revenue when it was issued.
          const matchedInvoiceId = matchByIndex[i] ?? null;
          await createIncome.mutateAsync({
            amount: t.amount,
            transaction_date: t.date,
            what_for: t.description,
            received_from: t.description,
            payment_method: t.method,
            sars_category: t.category,
            source: "bank_statement",
            account_id: importAccountId,
            vat_rate: isVatRegistered ? VAT_RATE : null,
            vat_amount: vatAmount,
            tax_jar_amount: net * TAX_JAR_RATE,
            matched_invoice_id: matchedInvoiceId,
          });
          // Settle the linked invoice only once the income row is safely saved,
          // and only when the deposit covers the full balance (mirrors
          // IncomeModal). A partial payment stays linked — so it's still deduped
          // in P&L — but leaves the invoice unpaid. If the update fails the income
          // is still recorded and the invoice can be marked paid by hand.
          if (matchedInvoiceId && markPaidByIndex[i]) {
            const inv = (invoices ?? []).find((iv) => iv.id === matchedInvoiceId);
            if (inv && paymentSettlesInvoice(inv, t.amount)) {
              await updateInvoice
                .mutateAsync({ id: matchedInvoiceId, changes: { status: "paid", paid_date: t.date, balance_due: 0 } })
                .catch(() => {});
            }
          }
        } else {
          // Same de-dup on the cost side: a bank payment that settles a supplier
          // invoice or a credit-book entry must be linked, or Profit & Loss counts
          // the cost twice — once when the bill was issued, once as this payment.
          const links = expLinksByIndex[i] ?? EMPTY_EXP;
          await createExpense.mutateAsync({
            amount: t.amount,
            transaction_date: t.date,
            what_for: t.description,
            paid_to: t.description,
            payment_method: t.method,
            sars_category: t.category,
            source: "bank_statement",
            account_id: importAccountId,
            matched_ledger_entry_id: links.ledgerId,
            matched_supplier_invoice_id: links.siId,
          });
          // Best-effort settle, gated on the payment actually covering it
          // (mirrors ExpenseModal). A shortfall stays linked but leaves it open.
          if (links.ledgerId && links.ledgerPaid) {
            const entry = supplierEntries.find((e) => e.id === links.ledgerId);
            if (entry && expenseSettlesEntry(entry, t.amount)) {
              await updateLedgerEntry
                .mutateAsync({ id: links.ledgerId, changes: { status: "paid", paid_date: t.date } })
                .catch(() => {});
            }
          }
          if (links.siId && links.siPaid) {
            const si = (supplierInvoices ?? []).find((s) => s.id === links.siId);
            if (si && expenseSettlesSupplierInvoice(si, t.amount)) {
              await updateSupplierInvoice
                .mutateAsync({
                  id: links.siId,
                  changes: { status: "paid", paid_date: t.date, paid_amount: si.invoice_amount, balance_due: 0 },
                })
                .catch(() => {});
            }
          }
        }
        savedIdxRef.current.add(i);
      }
      const saved = toSave.map(({ t }) => t);
      const dates = saved.map((t) => t.date).sort();
      const inMonth = inPeriod("month");
      setImported({
        count: saved.length,
        from: dates[0] ?? "",
        to: dates[dates.length - 1] ?? "",
        outOfMonth: saved.filter((t) => !inMonth(t.date)).length,
      });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the transactions.");
    }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const totalIncome = transactions.reduce((s, t, i) => s + (selected[i] && t.type === "income" ? t.amount : 0), 0);
  const totalExpense = transactions.reduce((s, t, i) => s + (selected[i] && t.type === "expense" ? t.amount : 0), 0);
  const saving =
    createIncome.isPending ||
    createExpense.isPending ||
    updateInvoice.isPending ||
    updateLedgerEntry.isPending ||
    updateSupplierInvoice.isPending;
  // How many ticked rows fall outside the current month — the dashboard's default
  // "Month" view won't show them, so we say so before the import, not only after.
  const isThisMonth = inPeriod("month");
  const selectedOutOfMonth = transactions.filter((t, i) => selected[i] && !isThisMonth(t.date)).length;

  // ── CONSENT ──
  if (step === "consent") {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <Header />
        <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🔒</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#0C4A6E", marginBottom: 12 }}>Before you upload</div>
          <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "14px 16px", marginBottom: 14, textAlign: "left" }}>
            {[
              "Your bank statement is sent to an AI service (Anthropic) to extract your transactions automatically.",
              "Anthropic does not store your data — it is processed and immediately discarded.",
              "Only the extracted transactions are saved in Worklog — not the original file.",
              "If your PDF is password-protected, it's unlocked on your phone — your password is never sent to us or the AI.",
              "Your data is never used to train AI models.",
            ].map((t) => (
              <div key={t} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 13, lineHeight: 1.5 }}>
                <span style={{ flexShrink: 0 }}>✅</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#92400e", textAlign: "left", lineHeight: 1.6 }}>
            By continuing you consent to your bank statement being processed by AI to extract transactions.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href="/dashboard"
              style={{ flex: 1, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 700, color: "#64748b", textDecoration: "none", textAlign: "center" }}
            >
              Cancel
            </Link>
            <button
              onClick={() => setStep("upload")}
              style={{ flex: 2, background: "#0C4A6E", border: "none", borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#fff" }}
            >
              I understand — continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── UPLOAD ──
  if (step === "upload") {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <Header />
        <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "12px 14px", marginBottom: 18, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
          Upload a PDF or a clear photo of your bank statement. Worklog reads every transaction and lets you pick which
          ones to keep before anything is saved.
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = ""; // let the same file be re-picked after an error
          }}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ width: "100%", background: "#fff", border: "2px dashed #BAE6FD", borderRadius: 14, padding: "28px 16px", cursor: "pointer", marginBottom: 12 }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0C4A6E" }}>{fileName || "Choose a PDF or photo"}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{fileName ? "Tap to choose a different file" : "PDF, JPG or PNG"}</div>
        </button>

        {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}

        {encrypted && (
          <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
            🔒 This PDF looks password-protected. We&apos;ll ask for the password next and unlock it on your phone.
          </div>
        )}

        <button
          onClick={beginImport}
          disabled={!fileData}
          style={{ width: "100%", background: fileData ? "#0C4A6E" : "#94a3b8", border: "none", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, color: "#fff", cursor: fileData ? "pointer" : "default" }}
        >
          {encrypted ? "🔓 Unlock & read my statement" : "✨ Read my statement"}
        </button>
      </div>
    );
  }

  // ── PROCESSING ──
  if (step === "processing") {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <Header />
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>✨</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0C4A6E", marginBottom: 6 }}>Reading your statement…</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>This can take up to a minute for a long statement.</div>
        </div>
      </div>
    );
  }

  // ── DONE ──
  if (step === "done") {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <Header />
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>✅</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#0C4A6E", marginBottom: 6 }}>
            {imported?.count ?? 0} transaction{(imported?.count ?? 0) !== 1 ? "s" : ""} imported
          </div>
          {imported?.from && (
            <div style={{ fontSize: 13, color: "#0369A1", fontWeight: 700, marginBottom: 6 }}>
              Dated {rangeLabel(imported.from, imported.to)}
            </div>
          )}
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: imported && imported.outOfMonth > 0 ? 16 : 24 }}>
            They&apos;re now in your Money records.
          </div>
          {imported && imported.outOfMonth > 0 && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 14px", marginBottom: 22, fontSize: 12.5, color: "#92400e", textAlign: "left", lineHeight: 1.6 }}>
              <strong>Heads-up:</strong> {imported.outOfMonth} of these {imported.outOfMonth === 1 ? "is" : "are"} dated outside this
              month, so they won&apos;t show in your dashboard&apos;s <strong>Month</strong> total. Switch the dashboard to{" "}
              <strong>Year</strong> or <strong>All</strong> to see them — they&apos;re always in your Money records and Profit &amp; Loss.
            </div>
          )}
          <Link
            href="/dashboard"
            style={{ display: "block", background: "#0C4A6E", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, color: "#fff", textDecoration: "none" }}
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ── PASSWORD (encrypted PDF) ──
  if (step === "password") {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <Header />
        <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔑</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#0C4A6E", marginBottom: 8 }}>This statement is password-protected</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14, lineHeight: 1.5 }}>
            Enter the password you use to open the PDF. It&apos;s unlocked here on your phone — your password is never sent
            anywhere.
          </div>
        </div>
        <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#0369A1", lineHeight: 1.55 }}>
          The password is usually in the email the statement came in. It&apos;s often your ID number, or one you set with your
          bank. Tip: many banks let you re-download the statement <strong>without</strong> a password from their app.
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitPassword();
          }}
          placeholder="PDF password"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          style={{ width: "100%", boxSizing: "border-box", padding: "13px 14px", fontSize: 15, border: "1.5px solid #BAE6FD", borderRadius: 12, marginBottom: 10 }}
        />
        {pwError && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 10 }}>{pwError}</p>}
        <button
          onClick={submitPassword}
          disabled={!password.trim()}
          style={{ width: "100%", background: password.trim() ? "#0C4A6E" : "#94a3b8", border: "none", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, color: "#fff", cursor: password.trim() ? "pointer" : "default", marginBottom: 10 }}
        >
          🔓 Unlock &amp; read
        </button>
        <button
          onClick={() => {
            setStep("upload");
            setPassword("");
            setPwError("");
          }}
          style={{ width: "100%", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, color: "#64748b", cursor: "pointer" }}
        >
          Choose a different file
        </button>
      </div>
    );
  }

  // ── REVIEW ──
  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <Header />
      <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#0369A1" }}>
        Found <strong>{transactions.length}</strong> transactions. Untick anything you don&apos;t want — nothing is saved
        until you tap Import.
      </div>

      {(accounts?.length ?? 0) > 0 && (
        <div style={{ background: "#fff", border: `1.5px solid ${detection && !detection.matched ? "#fed7aa" : "#e2e8f0"}`, borderRadius: 12, padding: "10px 14px 4px", marginBottom: 14 }}>
          {detection && (
            <div style={{ fontSize: 12, fontWeight: 600, color: detection.matched ? "#0369A1" : "#92400e", marginBottom: 6, lineHeight: 1.5 }}>
              {detection.matched ? "✓ " : "⚠️ "}
              {detection.note}
            </div>
          )}
          <BankAccountPicker
            value={importAccountId}
            onChange={setImportAccountId}
            label="Which account is this statement from?"
          />
        </div>
      )}

      {warning && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
          ⚠️ {warning}
        </div>
      )}

      {selectedOutOfMonth > 0 && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
          ⚠️ {selectedOutOfMonth} selected {selectedOutOfMonth === 1 ? "transaction is" : "transactions are"} dated outside this
          month. They&apos;ll still import — look under <strong>Year</strong> or <strong>All</strong> on the dashboard, not{" "}
          <strong>Month</strong>.
        </div>
      )}

      <div style={{ background: "#0C4A6E", borderRadius: 12, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10, color: "#7DD3FC", fontWeight: 700 }}>MONEY IN</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#7DD3FC" }}>{fmt(totalIncome)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#7DD3FC", fontWeight: 700 }}>MONEY OUT</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#FCA5A5" }}>{fmt(totalExpense)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#7DD3FC", fontWeight: 700 }}>SELECTED</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
            {selectedCount}/{transactions.length}
          </div>
        </div>
      </div>

      {((invoices?.length ?? 0) > 0 || supplierEntries.length > 0 || (supplierInvoices ?? []).some((si) => si.status !== "paid")) && (
        <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
          💡 Was a payment settling an invoice or bill you already logged? Link it below so the same money isn&apos;t counted twice in Profit &amp; Loss.
        </div>
      )}

      {transactions.map((t, i) => {
        const on = !!selected[i];
        return (
          <div key={i} style={{ marginBottom: 8 }}>
          <button
            onClick={() => setSelected((p) => ({ ...p, [i]: !p[i] }))}
            style={{ width: "100%", background: on ? "#fff" : "#f8fafc", border: `1.5px solid ${on ? "#BAE6FD" : "#e2e8f0"}`, borderRadius: 12, padding: "11px 14px", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: on ? 1 : 0.55 }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>
                {t.description}
                {t.confidence === "low" && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#92400e", background: "#fff7ed", border: "1px solid #fed7aa", padding: "1px 6px", borderRadius: 5, marginLeft: 6 }}>
                    ⚠️ check
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {t.date} · {t.category} · {t.method}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: t.type === "income" ? "#0369A1" : "#dc2626" }}>
                {t.type === "income" ? "+" : "−"}
                {fmt(t.amount)}
              </span>
              <span style={{ fontSize: 16, color: on ? "#0369A1" : "#cbd5e1" }}>{on ? "☑" : "☐"}</span>
            </div>
          </button>

          {on && t.type === "income" && (invoices?.length ?? 0) > 0 && (
            <div style={{ padding: "8px 6px 2px" }}>
              <InvoiceMatcher
                invoices={invoices ?? []}
                matchedId={matchByIndex[i] ?? null}
                onMatch={(id) => {
                  setMatchByIndex((p) => ({ ...p, [i]: id }));
                  // Default to marking paid when an invoice is picked; the matcher
                  // only surfaces the checkbox when the deposit actually covers it.
                  setMarkPaidByIndex((p) => ({ ...p, [i]: !!id }));
                }}
                paymentAmount={t.amount}
                markPaid={!!markPaidByIndex[i]}
                onMarkPaidChange={(next) => setMarkPaidByIndex((p) => ({ ...p, [i]: next }))}
              />
            </div>
          )}

          {on && t.type === "expense" && (supplierEntries.length > 0 || (supplierInvoices ?? []).some((si) => si.status !== "paid")) && (
            <div style={{ padding: "8px 6px 2px" }}>
              <LedgerEntryMatcher
                entries={supplierEntries}
                matchedId={(expLinksByIndex[i] ?? EMPTY_EXP).ledgerId}
                onMatch={(id) => setExpLinks(i, { ledgerId: id, ledgerPaid: !!id })}
                expenseAmount={t.amount}
                markPaid={(expLinksByIndex[i] ?? EMPTY_EXP).ledgerPaid}
                onMarkPaidChange={(next) => setExpLinks(i, { ledgerPaid: next })}
              />
              <SupplierInvoiceMatcher
                invoices={supplierInvoices ?? []}
                matchedId={(expLinksByIndex[i] ?? EMPTY_EXP).siId}
                onMatch={(id) => setExpLinks(i, { siId: id, siPaid: !!id })}
                expenseAmount={t.amount}
                markPaid={(expLinksByIndex[i] ?? EMPTY_EXP).siPaid}
                onMarkPaidChange={(next) => setExpLinks(i, { siPaid: next })}
              />
            </div>
          )}
          </div>
        );
      })}

      {error && <p style={{ color: "#dc2626", fontSize: 13, margin: "12px 0" }}>{error}</p>}

      <button
        onClick={saveSelected}
        disabled={selectedCount === 0 || saving}
        style={{ width: "100%", background: selectedCount === 0 || saving ? "#94a3b8" : "#0C4A6E", border: "none", borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, color: "#fff", cursor: selectedCount === 0 || saving ? "default" : "pointer", marginTop: 8 }}
      >
        {saving ? "Importing..." : `Import ${selectedCount} transaction${selectedCount !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
