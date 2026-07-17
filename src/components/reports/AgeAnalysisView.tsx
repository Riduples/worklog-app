"use client";

import { useState } from "react";
import { useInvoices } from "@/lib/supabase/hooks/useInvoices";
import { useSupplierInvoices } from "@/lib/supabase/hooks/useSupplierInvoices";
import { fmt, todayStr } from "@/lib/format";
import { BackLink } from "@/components/ui/BackLink";

type Bucket = "0–30" | "31–60" | "61–90" | "90+";
const BUCKETS: Bucket[] = ["0–30", "31–60", "61–90", "90+"];

const BUCKET_COLOR: Record<Bucket, { bg: string; border: string; text: string }> = {
  "0–30": { bg: "#F0F9FF", border: "#BAE6FD", text: "#0369A1" },
  "31–60": { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
  "61–90": { bg: "#fff7ed", border: "#fed7aa", text: "#9a3412" },
  "90+": { bg: "#fff1f2", border: "#fecdd3", text: "#be123c" },
};

function ageDays(dateStr: string | null): number {
  if (!dateStr) return 90;
  const days = Math.floor((new Date(todayStr()).getTime() - new Date(dateStr).getTime()) / 86400000);
  return days;
}

function bucketOf(days: number): Bucket {
  if (days <= 30) return "0–30";
  if (days <= 60) return "31–60";
  if (days <= 90) return "61–90";
  return "90+";
}

type AgedItem = { id: string; name: string; docNumber: string; date: string; days: number; bucket: Bucket; amount: number };

export function AgeAnalysisView() {
  const { data: invoices } = useInvoices();
  const { data: supplierInvoices } = useSupplierInvoices();
  const [tab, setTab] = useState<"debtors" | "creditors">("debtors");

  const debtors: AgedItem[] = (invoices ?? [])
    .filter((r) => r.status !== "paid")
    .map((r) => {
      const days = ageDays(r.due_date ?? r.issue_date);
      return {
        id: r.id,
        name: r.client_name,
        docNumber: r.doc_number,
        date: r.due_date ?? r.issue_date,
        days,
        bucket: bucketOf(days),
        amount: Number(r.balance_due) + Number(r.vat_amount ?? 0),
      };
    })
    .sort((a, b) => b.days - a.days);

  const creditors: AgedItem[] = (supplierInvoices ?? [])
    .filter((r) => r.status !== "paid")
    .map((r) => {
      const days = ageDays(r.due_date ?? r.issue_date);
      return {
        id: r.id,
        name: r.supplier_name,
        docNumber: r.supplier_ref_number ?? "",
        date: r.due_date ?? r.issue_date,
        days,
        bucket: bucketOf(days),
        amount: Number(r.balance_due) + Number(r.vat_amount ?? 0),
      };
    })
    .sort((a, b) => b.days - a.days);

  const isDebtors = tab === "debtors";
  const items = isDebtors ? debtors : creditors;
  const totals: Record<Bucket, number> = { "0–30": 0, "31–60": 0, "61–90": 0, "90+": 0 };
  items.forEach((i) => {
    totals[i.bucket] += i.amount;
  });
  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <BackLink />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 18px" }}>Age Analysis</h1>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {(
          [
            ["debtors", "💚 Debtors", "Clients who owe you"],
            ["creditors", "❤️ Creditors", "Suppliers you owe"],
          ] as const
        ).map(([v, l, s]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            style={{ flex: 1, padding: "10px 8px", border: `2px solid ${tab === v ? "#0C4A6E" : "#e2e8f0"}`, borderRadius: 12, background: tab === v ? "#0C4A6E" : "#fff", color: tab === v ? "#fff" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            <div>{l}</div>
            <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.8 }}>{s}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 16 }}>
        {BUCKETS.map((b) => {
          const c = BUCKET_COLOR[b];
          return (
            <div key={b} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: c.text, marginBottom: 4 }}>{b} days</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: c.text }}>{fmt(totals[b])}</div>
            </div>
          );
        })}
      </div>

      <div style={{ background: isDebtors ? "#F0F9FF" : "#fff1f2", border: `1.5px solid ${isDebtors ? "#BAE6FD" : "#fecdd3"}`, borderRadius: 12, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{isDebtors ? "Total outstanding from clients" : "Total owed to suppliers"}</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
            {items.length} {isDebtors ? "unpaid invoice" : "outstanding supplier invoice"}
            {items.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: isDebtors ? "#0369A1" : "#be123c" }}>{fmt(grandTotal)}</div>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 13 }}>
          {isDebtors ? "🎉 No outstanding client invoices" : "✅ No outstanding supplier invoices"}
        </div>
      ) : (
        BUCKETS.map((b) => {
          const bItems = items.filter((i) => i.bucket === b);
          if (!bItems.length) return null;
          const c = BUCKET_COLOR[b];
          return (
            <div key={b} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                <span>{b} days overdue</span>
                <span>{fmt(totals[b])}</span>
              </div>
              {bItems.map((item) => (
                <div key={item.id} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {item.docNumber} · {item.date || "—"} · {item.days} days
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: c.text, flexShrink: 0, marginLeft: 8 }}>{fmt(item.amount)}</div>
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
