"use client";

import { useState } from "react";
import { useSupplierInvoices, type SupplierInvoice } from "@/lib/supabase/hooks/useSupplierInvoices";
import { SupplierInvoiceModal } from "@/components/modals/SupplierInvoiceModal";
import { SupplierInvoiceActionsModal, supplierInvoiceDisplayStatus } from "@/components/modals/SupplierInvoiceActionsModal";
import { fmt } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { BackLink } from "@/components/ui/BackLink";

// Filter pills follow this order; only statuses actually in use get a pill.
const STATUS_ORDER = ["unpaid", "overdue", "paid", "credited"];

// Sort by our own internal bill number the same way the invoice/quote/PO
// dashboards sort by their doc number: pull the digits out and compare
// numerically, so SI-…-9 sits above SI-…-10 and any un-numbered row falls last.
const docNo = (si: SupplierInvoice) => parseInt((si.doc_number ?? "").replace(/\D/g, ""), 10) || 0;

export function SupplierInvoicesView() {
  const access = useToolAccess("supplierinvoice");
  const { data: invoices, isLoading } = useSupplierInvoices();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<SupplierInvoice | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sort, setSort] = useState<"az" | "number" | "recent">("recent");

  const presentStatuses = STATUS_ORDER.filter((s) => (invoices ?? []).some((si) => supplierInvoiceDisplayStatus(si).label === s));

  const filtered = (invoices ?? [])
    .filter((si) => {
      if (statusFilter !== "all" && supplierInvoiceDisplayStatus(si).label !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !si.supplier_name.toLowerCase().includes(s) &&
          !(si.supplier_ref_number ?? "").toLowerCase().includes(s) &&
          !(si.doc_number ?? "").toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "az") return a.supplier_name.localeCompare(b.supplier_name);
      if (sort === "number") return docNo(a) - docNo(b);
      return (b.created_at ?? b.issue_date ?? "").localeCompare(a.created_at ?? a.issue_date ?? "");
    });

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Supplier Invoices</h1>
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

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="supplier invoices" />}

      {!isLoading && (invoices ?? []).length > 0 && (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search supplier invoices..."
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, boxSizing: "border-box", marginBottom: 12, background: "#fff" }}
          />

          {presentStatuses.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {["all", ...presentStatuses].map((s) => {
                const active = statusFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    style={{ padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${active ? "#0C4A6E" : "#e2e8f0"}`, background: active ? "#0C4A6E" : "#fff", color: active ? "#fff" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}
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
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No supplier invoices yet.</p>
      )}
      {!isLoading && (invoices ?? []).length > 0 && filtered.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No supplier invoices match your search.</p>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "0 0 10px 2px" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {filtered.length}
            {filtered.length !== (invoices ?? []).length ? ` of ${(invoices ?? []).length}` : ""} bill{(invoices ?? []).length === 1 ? "" : "s"}
          </span>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
            {(["az", "number", "recent"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: sort === s ? "#fff" : "transparent", color: sort === s ? "#0C4A6E" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: sort === s ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
              >
                {s === "az" ? "A–Z" : s === "number" ? "Number" : "Recent"}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.map((si) => {
        const status = supplierInvoiceDisplayStatus(si);
        const totalInclVat = Number(si.invoice_amount) + Number(si.vat_amount ?? 0);
        return (
          <button
            key={si.id}
            onClick={() => setSelected(si)}
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
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{si.supplier_name}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {si.doc_number ? `${si.doc_number} · ` : ""}
                {si.supplier_ref_number ? `Ref ${si.supplier_ref_number} · ` : ""}
                {si.issue_date}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#0C4A6E" }}>{fmt(totalInclVat)}</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: status.bg, color: status.fg, textTransform: "uppercase" }}>
                {status.label}
              </span>
            </div>
          </button>
        );
      })}

      {showNew && <SupplierInvoiceModal onClose={() => setShowNew(false)} />}
      {selected && <SupplierInvoiceActionsModal si={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
