"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useInvoices, useUpdateInvoice, type Invoice } from "@/lib/supabase/hooks/useInvoices";
import { useQuotes } from "@/lib/supabase/hooks/useQuotes";
import { InvoiceModal } from "@/components/modals/InvoiceModal";
import { InvoiceActionsModal, displayStatus } from "@/components/modals/InvoiceActionsModal";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { RECURRENCE_LABEL, type Recurrence } from "@/lib/recurrence";
import { fmt } from "@/lib/format";
import { BackLink } from "@/components/ui/BackLink";

// Filter pills follow this order; only statuses actually in use get a pill.
const STATUS_ORDER = ["unpaid", "part paid", "overdue", "paid", "credited"];

const invoiceNo = (inv: Invoice) => parseInt((inv.doc_number ?? "").replace(/\D/g, ""), 10) || 0;

export function InvoicesView() {
  const { data: invoices, isLoading } = useInvoices();
  const { data: quotes } = useQuotes();
  const updateInvoice = useUpdateInvoice();
  const access = useToolAccess("invoice");
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sort, setSort] = useState<"az" | "number" | "recent">("az");
  const searchParams = useSearchParams();
  const router = useRouter();

  const fromQuoteId = searchParams.get("fromQuote");
  const sourceQuote = fromQuoteId ? (quotes ?? []).find((q) => q.id === fromQuoteId) : undefined;

  const closeConversion = () => router.replace("/invoices");

  const presentStatuses = STATUS_ORDER.filter((s) => (invoices ?? []).some((inv) => displayStatus(inv).label === s));

  const filtered = (invoices ?? [])
    .filter((inv) => {
      if (statusFilter !== "all" && displayStatus(inv).label !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!inv.client_name.toLowerCase().includes(s) && !(inv.doc_number ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "az") return a.client_name.localeCompare(b.client_name);
      if (sort === "number") return invoiceNo(a) - invoiceNo(b);
      return (b.created_at ?? b.issue_date ?? "").localeCompare(a.created_at ?? a.issue_date ?? "");
    });

  // The soft delete the other list tools have. An invoice is a document a customer
  // has seen, so the prompt says plainly what leaving the books means — the figure
  // stops counting as revenue, which is a bigger deal than removing a row.
  const handleSoftDelete = (inv: Invoice) => {
    if (!confirm(`Remove invoice ${inv.doc_number ?? ""} for ${inv.client_name}? It comes off your invoice list and out of the reports that read invoices, including your revenue and VAT figures.`)) return;
    updateInvoice.mutate({ id: inv.id, changes: { deleted_at: new Date().toISOString() } });
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Invoices</h1>
        </div>
        {access.canEdit && (
          <button
            onClick={() => setShowNew(true)}
            style={{ background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + New
          </button>
        )}
      </div>

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="invoices" />}

      {!isLoading && (invoices ?? []).length > 0 && (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoices..."
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1.5px solid #e2e8f0",
              fontSize: 14,
              boxSizing: "border-box",
              marginBottom: 12,
              background: "#fff",
            }}
          />

          {presentStatuses.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {["all", ...presentStatuses].map((s) => {
                const active = statusFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 20,
                      border: `1.5px solid ${active ? "#0C4A6E" : "#e2e8f0"}`,
                      background: active ? "#0C4A6E" : "#fff",
                      color: active ? "#fff" : "#374151",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {s === "all" ? "All" : s}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (invoices ?? []).length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No invoices yet.</p>
      )}
      {!isLoading && (invoices ?? []).length > 0 && filtered.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No invoices match your search.</p>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "0 0 10px 2px" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {filtered.length}
            {filtered.length !== (invoices ?? []).length ? ` of ${(invoices ?? []).length}` : ""} invoice{(invoices ?? []).length === 1 ? "" : "s"}
          </span>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
            {(["az", "number", "recent"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: sort === s ? "#fff" : "transparent",
                  color: sort === s ? "#0C4A6E" : "#64748b",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: sort === s ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                {s === "az" ? "A–Z" : s === "number" ? "Number" : "Recent"}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.map((inv) => {
        const status = displayStatus(inv);
        const totalInclVat = Number(inv.invoice_amount) + Number(inv.vat_amount ?? 0);
        return (
          // The Customers row: tap the body to open, ✕ to remove.
          <div
            key={inv.id}
            style={{
              background: "#fff",
              borderRadius: 13,
              padding: "12px 14px",
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}
          >
          <button
            onClick={() => setSelected(inv)}
            style={{
              flex: 1,
              minWidth: 0,
              background: "none",
              border: "none",
              padding: 0,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{inv.client_name}</span>
                {inv.recurrence !== "none" && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: "#F0F9FF", color: "#0369A1", border: "1px solid #BAE6FD" }}>
                    🔁 {RECURRENCE_LABEL[inv.recurrence as Recurrence]}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {inv.doc_number} · {inv.issue_date}
                {inv.recurrence !== "none" && inv.next_run_date ? ` · next ${inv.next_run_date}` : ""}
                {inv.recurrence_parent_id ? " · auto-created" : ""}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#0C4A6E" }}>{fmt(totalInclVat)}</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: status.bg, color: status.fg, textTransform: "uppercase" }}>
                {status.label}
              </span>
            </div>
          </button>
          {access.canDelete && (
            <button
              onClick={() => handleSoftDelete(inv)}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 4, marginLeft: 4 }}
              aria-label="Remove invoice"
            >
              ✕
            </button>
          )}
          </div>
        );
      })}

      {showNew && <InvoiceModal onClose={() => setShowNew(false)} />}
      {selected && <InvoiceActionsModal invoice={selected} onClose={() => setSelected(null)} />}
      {sourceQuote && <InvoiceModal sourceQuote={sourceQuote} onClose={closeConversion} />}
    </div>
  );
}
