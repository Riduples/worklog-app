"use client";

import { useState } from "react";
import Link from "next/link";
import { useStockItems, useUpdateStockItem, type StockItem } from "@/lib/supabase/hooks/useStock";
import { StockModal } from "@/components/modals/StockModal";
import { CSVImportModal } from "@/components/modals/CSVImportModal";
import { fmt } from "@/lib/format";

export function StockView() {
  const { data: items, isLoading } = useStockItems();
  const updateStockItem = useUpdateStockItem();
  const [modalState, setModalState] = useState<{ open: boolean; item?: StockItem }>({ open: false });
  const [importOpen, setImportOpen] = useState(false);

  const handleSoftDelete = (id: string) => {
    if (!confirm("Remove this stock item?")) return;
    updateStockItem.mutate({ id, changes: { deleted_at: new Date().toISOString() } });
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <Link href="/dashboard" style={{ fontSize: 12, color: "#64748b" }}>
            ← Dashboard
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1B4332", margin: "4px 0 0" }}>Stock</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setImportOpen(true)}
            style={{
              background: "#f0fdf4",
              color: "#166534",
              border: "1.5px solid #d1fae5",
              borderRadius: 12,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ⬆ Import
          </button>
          <button
            onClick={() => setModalState({ open: true })}
            style={{
              background: "#1B4332",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Add
          </button>
        </div>
      </div>

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (items ?? []).length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No stock items yet.</p>
      )}

      {(items ?? []).map((item) => {
        const lowStock = item.reorder_level != null && item.reorder_level > 0 && item.qty <= item.reorder_level;
        return (
          <div
            key={item.id}
            style={{
              background: "#fff",
              borderRadius: 13,
              padding: "12px 14px",
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              border: lowStock ? "1.5px solid #fecdd3" : "none",
            }}
          >
            <button
              onClick={() => setModalState({ open: true, item })}
              style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", flex: 1, padding: 0 }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{item.name}</div>
              <div style={{ fontSize: 11, color: lowStock ? "#be123c" : "#94a3b8" }}>
                {item.qty} in stock{lowStock ? " · Low stock!" : ""} · {fmt(item.sell_price)} each
                {item.margin_pct != null ? ` · ${Number(item.margin_pct).toFixed(0)}% margin` : ""}
              </div>
            </button>
            <button
              onClick={() => handleSoftDelete(item.id)}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 4 }}
              aria-label="Remove stock item"
            >
              ✕
            </button>
          </div>
        );
      })}

      {modalState.open && <StockModal item={modalState.item} onClose={() => setModalState({ open: false })} />}
      {importOpen && <CSVImportModal type="stock" onClose={() => setImportOpen(false)} />}
    </div>
  );
}
