"use client";

import { useState } from "react";
import { useStockItems, useUpdateStockItem, type StockItem } from "@/lib/supabase/hooks/useStock";
import { StockModal } from "@/components/modals/StockModal";
import { CSVImportModal } from "@/components/modals/CSVImportModal";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { fmt } from "@/lib/format";
import { ITEM_TYPES, ITEM_TYPE_META, itemTypeMeta, type ItemType } from "@/lib/itemTypes";
import { BackLink } from "@/components/ui/BackLink";

export function StockView() {
  const { data: items, isLoading } = useStockItems();
  const updateStockItem = useUpdateStockItem();
  const access = useToolAccess("stock");
  const [modalState, setModalState] = useState<{ open: boolean; item?: StockItem }>({ open: false });
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ItemType | "all">("all");

  // Only offer filter pills for types the business actually has, in the
  // canonical order — a filter that would show nothing is just clutter.
  const presentTypes = ITEM_TYPES.filter((t) => (items ?? []).some((i) => i.item_type === t));
  const filtered = (items ?? []).filter((i) => {
    if (typeFilter !== "all" && i.item_type !== typeFilter) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSoftDelete = (id: string) => {
    if (!confirm("Remove this item?")) return;
    updateStockItem.mutate({ id, changes: { deleted_at: new Date().toISOString() } });
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Items</h1>
        </div>
        {access.canEdit && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setImportOpen(true)}
              style={{
                background: "#F0F9FF",
                color: "#0369A1",
                border: "1.5px solid #BAE6FD",
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
                background: "#0C4A6E",
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
        )}
      </div>

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="stock items" />}

      {!isLoading && (items ?? []).length > 0 && (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
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

          {presentTypes.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {(["all", ...presentTypes] as const).map((t) => {
                const active = typeFilter === t;
                const label = t === "all" ? "All" : `${ITEM_TYPE_META[t].icon} ${ITEM_TYPE_META[t].label}`;
                return (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 20,
                      border: `1.5px solid ${active ? "#0C4A6E" : "#e2e8f0"}`,
                      background: active ? "#0C4A6E" : "#fff",
                      color: active ? "#fff" : "#374151",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (items ?? []).length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No items yet.</p>
      )}
      {!isLoading && (items ?? []).length > 0 && filtered.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No items match your search.</p>
      )}

      {!isLoading && filtered.length > 0 && (
        <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 8px 2px" }}>
          {filtered.length}
          {filtered.length !== (items ?? []).length ? ` of ${(items ?? []).length}` : ""} item{(items ?? []).length === 1 ? "" : "s"}
        </p>
      )}

      {filtered.map((item) => {
        const lowStock = item.reorder_level != null && item.reorder_level > 0 && item.qty <= item.reorder_level;
        const meta = itemTypeMeta(item.item_type);
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
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{item.name}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: meta.color,
                    background: meta.bg,
                    borderRadius: 6,
                    padding: "1px 6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {meta.icon} {meta.label}
                </span>
              </div>
              <div style={{ fontSize: 11, color: lowStock ? "#be123c" : "#94a3b8" }}>
                {item.qty} in stock{lowStock ? " · Low stock!" : ""} · {fmt(item.sell_price)} each
                {item.margin_pct != null ? ` · ${Number(item.margin_pct).toFixed(0)}% margin` : ""}
              </div>
            </button>
            {access.canDelete && (
              <button
                onClick={() => handleSoftDelete(item.id)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 4 }}
                aria-label="Remove stock item"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      {modalState.open && (
        <StockModal
          item={modalState.item}
          onClose={() => setModalState({ open: false })}
          onImport={() => {
            setModalState({ open: false });
            setImportOpen(true);
          }}
        />
      )}
      {importOpen && <CSVImportModal type="stock" onClose={() => setImportOpen(false)} />}
    </div>
  );
}
