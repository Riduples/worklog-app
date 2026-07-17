"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useCreateIncome } from "@/lib/supabase/hooks/useIncome";
import { useCreateExpense } from "@/lib/supabase/hooks/useExpenses";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTaxRates } from "@/lib/taxRates";
import { fmt } from "@/lib/format";

type ParsedTxn = {
  date: string;
  description: string;
  type: "income" | "expense";
  amount: number;
  method: string;
  category: string;
  confidence: "high" | "low";
};

type Step = "consent" | "upload" | "processing" | "review" | "done";

export function BankStatementView() {
  const createIncome = useCreateIncome();
  const createExpense = useCreateExpense();
  const { TAX_JAR_RATE, VAT_RATE, vatFromGross } = useTaxRates();
  const { data: business } = useBusinessProfile();
  const isVatRegistered = !!business?.vat_number;

  const [step, setStep] = useState<Step>("consent");
  const [fileData, setFileData] = useState<{ base64: string; mediaType: string } | null>(null);
  const [fileName, setFileName] = useState("");
  const [transactions, setTransactions] = useState<ParsedTxn[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError("");
    setFileName(file.name || "statement");
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result !== "string") return;
      setFileData({ base64: result.split(",")[1], mediaType: file.type || "image/jpeg" });
    };
    reader.readAsDataURL(file);
  };

  const parseStatement = async () => {
    if (!fileData) return;
    setStep("processing");
    setError("");
    try {
      const res = await fetch("/api/parse-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: fileData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Couldn't read the statement.");
      const txns = data.transactions as ParsedTxn[];
      setTransactions(txns);
      setSelected(Object.fromEntries(txns.map((_, i) => [i, true])));
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read the statement.");
      setStep("upload");
    }
  };

  const saveSelected = async () => {
    const toSave = transactions.filter((_, i) => selected[i]);
    setError("");
    try {
      for (const t of toSave) {
        if (t.type === "income") {
          // A bank statement only ever shows the gross amount that landed, so
          // any VAT is inside it and has to be extracted rather than added.
          const vatAmount = isVatRegistered ? vatFromGross(t.amount, VAT_RATE) : 0;
          const net = t.amount - vatAmount;
          await createIncome.mutateAsync({
            amount: t.amount,
            transaction_date: t.date,
            what_for: t.description,
            received_from: t.description,
            payment_method: t.method,
            sars_category: t.category,
            source: "bank_statement",
            vat_rate: isVatRegistered ? VAT_RATE : null,
            vat_amount: vatAmount,
            tax_jar_amount: net * TAX_JAR_RATE,
          });
        } else {
          await createExpense.mutateAsync({
            amount: t.amount,
            transaction_date: t.date,
            what_for: t.description,
            paid_to: t.description,
            payment_method: t.method,
            sars_category: t.category,
            source: "bank_statement",
          });
        }
      }
      setSavedCount(toSave.length);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the transactions.");
    }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const totalIncome = transactions.reduce((s, t, i) => s + (selected[i] && t.type === "income" ? t.amount : 0), 0);
  const totalExpense = transactions.reduce((s, t, i) => s + (selected[i] && t.type === "expense" ? t.amount : 0), 0);
  const saving = createIncome.isPending || createExpense.isPending;

  const Header = () => (
    <>
      <Link href="/dashboard" style={{ fontSize: 12, color: "#64748b" }}>
        ← Dashboard
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>Import Bank Statement</h1>
    </>
  );

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
          onChange={(e) => handleFile(e.target.files?.[0])}
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

        <button
          onClick={parseStatement}
          disabled={!fileData}
          style={{ width: "100%", background: fileData ? "#0C4A6E" : "#94a3b8", border: "none", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, color: "#fff", cursor: fileData ? "pointer" : "default" }}
        >
          ✨ Read my statement
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
            {savedCount} transaction{savedCount !== 1 ? "s" : ""} imported
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>They&apos;re now in your Money records.</div>
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

  // ── REVIEW ──
  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <Header />
      <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#0369A1" }}>
        Found <strong>{transactions.length}</strong> transactions. Untick anything you don&apos;t want — nothing is saved
        until you tap Import.
      </div>

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

      {transactions.map((t, i) => {
        const on = !!selected[i];
        return (
          <button
            key={i}
            onClick={() => setSelected((p) => ({ ...p, [i]: !p[i] }))}
            style={{ width: "100%", background: on ? "#fff" : "#f8fafc", border: `1.5px solid ${on ? "#BAE6FD" : "#e2e8f0"}`, borderRadius: 12, padding: "11px 14px", marginBottom: 8, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: on ? 1 : 0.55 }}
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
