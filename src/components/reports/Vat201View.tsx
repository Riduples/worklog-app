"use client";

import { useState } from "react";
import Link from "next/link";
import { useInvoices } from "@/lib/supabase/hooks/useInvoices";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useSupplierInvoices } from "@/lib/supabase/hooks/useSupplierInvoices";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTaxFilings, useMarkFiled } from "@/lib/supabase/hooks/useTaxFilings";
import { useCreditNotes } from "@/lib/supabase/hooks/useCreditNotes";
import { sumCreditVat } from "@/lib/creditNotes";
import { fmt, toLocalIsoDate } from "@/lib/format";
import { suppliesByType } from "@/lib/vat201";
import { shareReport } from "@/lib/docgen/shareReport";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Period is a [year, startMonth0] pair. Monthly = 1 calendar month; Bi-monthly
// = the SARS convention of Jan/Feb, Mar/Apr, ... calendar-year pairs.
// The dates below decide which transactions are declared to SARS, so they have
// to be the calendar days the owner means. They are read locally, via
// toLocalIsoDate: the old .toISOString() converted a local-midnight Date to UTC
// first, and in SAST that rolled BOTH ends back a day. July 2026 came out as
// 30 June – 30 July, so the month's last day of sales was left out of its own
// return and the previous month's last day was pulled into it. Jan–Feb came out
// starting 31 December, in the wrong calendar year. It was correct under UTC —
// which no user of this app is.
// Exported for the tests. It decides what a business declares to SARS, which is
// reason enough for it to be checkable on its own rather than only through a
// screen nothing renders in CI.
export function periodRange(year: number, startMonth0: number, monthly: boolean) {
  const span = monthly ? 1 : 2;
  const from = new Date(year, startMonth0, 1);
  const to = new Date(year, startMonth0 + span, 0); // day 0 = last day of the previous month
  const label = monthly ? `${MONTH_NAMES[startMonth0]} ${year}` : `${MONTH_NAMES[startMonth0]}–${MONTH_NAMES[startMonth0 + 1]} ${year}`;
  return { fromDate: toLocalIsoDate(from), toDate: toLocalIsoDate(to), label };
}

export function Vat201View() {
  const { data: business } = useBusinessProfile();
  const { data: invoices } = useInvoices();
  const { data: income } = useIncome();
  const { data: supplierInvoices } = useSupplierInvoices();
  const { data: creditNotes } = useCreditNotes();
  const { data: filings } = useTaxFilings();
  const markFiled = useMarkFiled();

  const monthly = business?.vat_period === "Monthly";
  const today = new Date();
  const currentStartMonth = monthly ? today.getMonth() : Math.floor(today.getMonth() / 2) * 2;
  const [year, setYear] = useState(today.getFullYear());
  const [startMonth0, setStartMonth0] = useState(currentStartMonth);

  const { fromDate, toDate, label } = periodRange(year, startMonth0, monthly);

  const step = (dir: 1 | -1) => {
    const span = monthly ? 1 : 2;
    let m = startMonth0 + dir * span;
    let y = year;
    if (m < 0) {
      m += 12;
      y -= 1;
    } else if (m > 11) {
      m -= 12;
      y += 1;
    }
    setYear(y);
    setStartMonth0(m);
  };

  const invoicedVAT = (invoices ?? [])
    .filter((r) => r.issue_date >= fromDate && r.issue_date <= toDate)
    .reduce((s, r) => s + Number(r.vat_amount ?? 0), 0);

  // Sales that never became an invoice — a till sale, a card tap, a line off a
  // bank statement — still carry output VAT. Leaving them out under-declared it.
  //
  // Income linked to an invoice is excluded: that invoice already contributed
  // its own vat_amount above, so counting the payment too would declare the
  // same VAT twice.
  const cashSalesVAT = (income ?? [])
    .filter((r) => !r.matched_invoice_id && r.transaction_date >= fromDate && r.transaction_date <= toDate)
    .reduce((s, r) => s + Number(r.vat_amount ?? 0), 0);

  // Credit notes reverse VAT already declared. A customer credit note lowers the
  // output VAT charged on a sale; a supplier credit note lowers the input VAT
  // claimed on a purchase. Net each against its own side of the return.
  const periodCredits = (creditNotes ?? []).filter((c) => c.issue_date >= fromDate && c.issue_date <= toDate);
  const custCreditVat = sumCreditVat(periodCredits, "customer");
  const suppCreditVat = sumCreditVat(periodCredits, "supplier");
  const hasCustCredits = periodCredits.some((c) => c.ledger === "customer");

  const outputVAT = invoicedVAT + cashSalesVAT - custCreditVat;
  const inputVAT = (supplierInvoices ?? [])
    .filter((r) => r.issue_date >= fromDate && r.issue_date <= toDate)
    .reduce((s, r) => s + Number(r.vat_amount ?? 0), 0) - suppCreditVat;
  const vatDue = outputVAT - inputVAT;

  // Turnover split by VAT supply type — VAT201 fields 1 (standard), 2 (zero-
  // rated) and 3 (exempt), all ex-VAT and net of customer credit notes, so the
  // declared supply values move with the output VAT above instead of staying
  // gross while the VAT nets. The split and the credit-note netting live in
  // suppliesByType so they can be tested on their own — see src/lib/vat201.ts.
  const {
    standard: standardTurnover,
    zero_rated: zeroRatedTurnover,
    exempt: exemptTurnover,
    total: totalTurnover,
  } = suppliesByType(invoices ?? [], income ?? [], creditNotes ?? [], fromDate, toDate);

  const vat201Filings = (filings ?? []).filter((f) => f.filing_type === "vat201");
  const alreadyFiled = vat201Filings.some((f) => f.period_label === label);

  const handleShare = () => {
    const lines = [
      `Standard-rated supplies (excl. VAT): ${fmt(standardTurnover)}`,
      ...(zeroRatedTurnover > 0 ? [`Zero-rated supplies: ${fmt(zeroRatedTurnover)}`] : []),
      ...(exemptTurnover > 0 ? [`Exempt supplies: ${fmt(exemptTurnover)}`] : []),
      `Output VAT (on sales): ${fmt(outputVAT)}`,
      ...(custCreditVat > 0 ? [`Less credit notes: −${fmt(custCreditVat)}`] : []),
      `Input VAT (on purchases): ${fmt(inputVAT)}`,
      ...(suppCreditVat > 0 ? [`Less credit notes: −${fmt(suppCreditVat)}`] : []),
      `${vatDue >= 0 ? "VAT payable" : "VAT refund due"}: ${fmt(Math.abs(vatDue))}`,
    ];
    void shareReport("VAT201", `${label} · ${business?.vat_period ?? ""}`, lines, business);
  };

  if (!business?.vat_number) {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <Link href="/tax" style={{ fontSize: 12, color: "#64748b" }}>
          ← Compliance & Financials
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>VAT201</h1>
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, textAlign: "center", fontSize: 13, color: "#64748b" }}>
          🏦 Not VAT registered. Add your VAT number in{" "}
          <Link href="/tax" style={{ color: "#0C4A6E", fontWeight: 700 }}>
            Business Details
          </Link>{" "}
          to enable VAT201.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <Link href="/tax" style={{ fontSize: 12, color: "#64748b" }}>
        ← Compliance & Financials
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>VAT201</h1>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={() => step(-1)} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 16, cursor: "pointer" }}>
          ‹
        </button>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{label}</div>
        <button onClick={() => step(1)} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 16, cursor: "pointer" }}>
          ›
        </button>
      </div>

      <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: "16px 18px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          Supplies this period (excl. VAT)
        </div>
        {([
          ["Standard-rated (15%)", standardTurnover],
          ["Zero-rated (0%)", zeroRatedTurnover],
          ["Exempt", exemptTurnover],
        ] as [string, number][]).map(([l, v]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "#374151" }}>{l}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#0C4A6E" }}>{fmt(v)}</span>
          </div>
        ))}
        <div style={{ borderTop: "1px solid #e2e8f0", marginTop: 6, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>Total turnover</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#0C4A6E" }}>{fmt(totalTurnover)}</span>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, lineHeight: 1.5 }}>
          VAT201 fields 1–3. Only standard-rated supplies produce output VAT — zero-rated and exempt turnover is declared but
          carries none.{hasCustCredits ? " Customer credit notes are already deducted from the supply type they were raised against." : ""}
        </div>
      </div>

      <div style={{ background: "#0C4A6E", borderRadius: 16, padding: "18px 20px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          {label} — {business.vat_period}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: "#7DD3FC" }}>Output VAT (on sales)</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{fmt(outputVAT)}</span>
        </div>
        {custCreditVat > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "#7DD3FC" }}>Less credit notes</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>−{fmt(custCreditVat)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: "#7DD3FC" }}>Input VAT (on purchases)</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>−{fmt(inputVAT)}</span>
        </div>
        {suppCreditVat > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: "#7DD3FC" }}>Less credit notes</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>−{fmt(suppCreditVat)}</span>
          </div>
        )}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, color: "#38BDF8", fontWeight: 700 }}>{vatDue >= 0 ? "VAT payable" : "VAT refund due"}</span>
          <span style={{ fontSize: 24, color: "#fff", fontWeight: 900 }}>{fmt(Math.abs(vatDue))}</span>
        </div>
      </div>

      {alreadyFiled ? (
        <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#0369A1" }}>
          ✅ Marked as filed for {label}
        </div>
      ) : (
        <button
          onClick={() => markFiled.mutate({ filing_type: "vat201", period_label: label, amount: vatDue })}
          disabled={markFiled.isPending}
          style={{ width: "100%", background: "#0369A1", border: "none", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, color: "#fff", cursor: markFiled.isPending ? "default" : "pointer", marginBottom: 14 }}
        >
          {markFiled.isPending ? "Saving..." : "✔️ Mark VAT201 as filed"}
        </button>
      )}

      <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#92400e", lineHeight: 1.6, marginBottom: 14 }}>
        Submit the actual VAT201 return via SARS eFiling — this is a calculation aid, not a filing. Due by the 25th of the month after the period ends.
      </div>

      <button
        onClick={handleShare}
        style={{ width: "100%", marginBottom: 14, background: "#F0F9FF", color: "#0C4A6E", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
      >
        📤 Share report
      </button>

      {vat201Filings.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Filing history</div>
          {vat201Filings.map((f) => (
            <div key={f.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{f.period_label}</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {fmt(f.amount)} · filed {f.filed_date}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
