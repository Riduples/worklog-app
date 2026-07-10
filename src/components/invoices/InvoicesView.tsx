"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useInvoices, type Invoice } from "@/lib/supabase/hooks/useInvoices";
import { useQuotes } from "@/lib/supabase/hooks/useQuotes";
import { InvoiceModal } from "@/components/modals/InvoiceModal";
import { InvoiceActionsModal, displayStatus } from "@/components/modals/InvoiceActionsModal";
import { fmt } from "@/lib/format";

export function InvoicesView() {
  const { data: invoices, isLoading } = useInvoices();
  const { data: quotes } = useQuotes();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const fromQuoteId = searchParams.get("fromQuote");
  const sourceQuote = fromQuoteId ? (quotes ?? []).find((q) => q.id === fromQuoteId) : undefined;

  const closeConversion = () => router.replace("/invoices");

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <Link href="/dashboard" style={{ fontSize: 12, color: "#64748b" }}>
            ← Dashboard
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1B4332", margin: "4px 0 0" }}>Invoices</h1>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ background: "#1B4332", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          + New
        </button>
      </div>

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (invoices ?? []).length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No invoices yet.</p>
      )}

      {(invoices ?? []).map((inv) => {
        const status = displayStatus(inv);
        const totalInclVat = Number(inv.invoice_amount) + Number(inv.vat_amount ?? 0);
        return (
          <button
            key={inv.id}
            onClick={() => setSelected(inv)}
            style={{
              width: "100%",
              background: "#fff",
              borderRadius: 13,
              padding: "12px 14px",
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{inv.client_name}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {inv.doc_number} · {inv.issue_date}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#1B4332" }}>{fmt(totalInclVat)}</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: status.bg, color: status.fg, textTransform: "uppercase" }}>
                {status.label}
              </span>
            </div>
          </button>
        );
      })}

      {showNew && <InvoiceModal onClose={() => setShowNew(false)} />}
      {selected && <InvoiceActionsModal invoice={selected} onClose={() => setSelected(null)} />}
      {sourceQuote && <InvoiceModal sourceQuote={sourceQuote} onClose={closeConversion} />}
    </div>
  );
}
