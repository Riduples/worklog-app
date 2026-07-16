"use client";

import { useState } from "react";
import Link from "next/link";
import { useSupplierInvoices, type SupplierInvoice } from "@/lib/supabase/hooks/useSupplierInvoices";
import { SupplierInvoiceModal } from "@/components/modals/SupplierInvoiceModal";
import { SupplierInvoiceActionsModal, supplierInvoiceDisplayStatus } from "@/components/modals/SupplierInvoiceActionsModal";
import { fmt } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";

export function SupplierInvoicesView() {
  const access = useToolAccess("supplierinvoice");
  const { data: invoices, isLoading } = useSupplierInvoices();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<SupplierInvoice | null>(null);

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <Link href="/dashboard" style={{ fontSize: 12, color: "#64748b" }}>
            ← Dashboard
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1B4332", margin: "4px 0 0" }}>Supplier Invoices</h1>
        </div>
        {access.canEdit && (
          <button
            onClick={() => setShowNew(true)}
            style={{ background: "#1B4332", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + New
          </button>
        )}
      </div>

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="supplier invoices" />}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (invoices ?? []).length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No supplier invoices yet.</p>
      )}

      {(invoices ?? []).map((si) => {
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
                {si.supplier_ref_number ? `${si.supplier_ref_number} · ` : ""}
                {si.issue_date}
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

      {showNew && <SupplierInvoiceModal onClose={() => setShowNew(false)} />}
      {selected && <SupplierInvoiceActionsModal si={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
