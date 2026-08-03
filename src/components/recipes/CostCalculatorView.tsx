"use client";

import { useState } from "react";
import { useCostings, useUpdateCosting, type Costing } from "@/lib/supabase/hooks/useCostings";
import { CostingModal } from "@/components/modals/CostingModal";
import { fmt } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { BackLink } from "@/components/ui/BackLink";

// The Cost Calculator (tool id "recipe", route /recipes). Job costing on a
// materials + labour model, backed by the costings table.
export function CostCalculatorView() {
  const access = useToolAccess("recipe");
  const { data: costings, isLoading } = useCostings();
  const updateCosting = useUpdateCosting();
  const [modalState, setModalState] = useState<{ open: boolean; costing?: Costing }>({ open: false });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"az" | "recent">("az");

  const handleSoftDelete = (id: string) => {
    if (!confirm("Remove this costing?")) return;
    updateCosting.mutate({ id, changes: { deleted_at: new Date().toISOString() } });
  };

  const filtered = (costings ?? [])
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === "recent"
        ? (b.updated_at ?? b.created_at ?? "").localeCompare(a.updated_at ?? a.created_at ?? "")
        : a.name.localeCompare(b.name)
    );

  const fmtDate = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Cost Calculator</h1>
        </div>
        {access.canEdit && (
          <button
            onClick={() => setModalState({ open: true })}
            style={{ background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + New
          </button>
        )}
      </div>
      <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16, lineHeight: 1.5 }}>
        Cost a job or product from your materials, products and labour, add a markup to see a suggested price, and save it to your price list.
      </p>

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="costings" />}

      {!isLoading && (costings ?? []).length > 0 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search costings..."
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
      )}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (costings ?? []).length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No costings yet. Tap “+ New” to cost your first job.</p>
      )}
      {!isLoading && (costings ?? []).length > 0 && filtered.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No costings match your search.</p>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 10px 2px" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {filtered.length}
            {filtered.length !== (costings ?? []).length ? ` of ${(costings ?? []).length}` : ""} costing{(costings ?? []).length === 1 ? "" : "s"}
          </span>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
            {(["az", "recent"] as const).map((s) => (
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
                {s === "az" ? "A–Z" : "Recent"}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.map((c) => (
        <div
          key={c.id}
          style={{
            background: "#fff",
            borderRadius: 13,
            padding: "12px 14px",
            marginBottom: 8,
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <button
            onClick={() => setModalState({ open: true, costing: c })}
            style={{
              flex: 1,
              textAlign: "left",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                Cost {fmt(c.total_cost)}
                {Number(c.labour_hours) > 0 ? ` · ${Number(c.labour_hours).toFixed(1)}h labour` : ""}
                {fmtDate(c.updated_at ?? c.created_at) ? ` · updated ${fmtDate(c.updated_at ?? c.created_at)}` : ""}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0C4A6E" }}>{fmt(c.suggested_price)}</div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>suggested</div>
            </div>
          </button>
          {access.canDelete && (
            <button
              onClick={() => handleSoftDelete(c.id)}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 4 }}
              aria-label="Remove costing"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      {modalState.open && <CostingModal costing={modalState.costing} onClose={() => setModalState({ open: false })} />}
    </div>
  );
}
