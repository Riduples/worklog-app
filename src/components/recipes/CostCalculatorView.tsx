"use client";

import { useState } from "react";
import { useCostings, type Costing } from "@/lib/supabase/hooks/useCostings";
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
  const [modalState, setModalState] = useState<{ open: boolean; costing?: Costing }>({ open: false });

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
        Cost a job or product from your materials and labour, add a markup to see a suggested price, and save it to your price list.
      </p>

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="costings" />}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (costings ?? []).length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No costings yet. Tap “+ New” to cost your first job.</p>
      )}

      {(costings ?? []).map((c) => (
        <button
          key={c.id}
          onClick={() => setModalState({ open: true, costing: c })}
          style={{
            width: "100%",
            textAlign: "left",
            background: "#fff",
            borderRadius: 13,
            padding: "12px 14px",
            marginBottom: 8,
            border: "none",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{c.name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              Cost {fmt(c.total_cost)}
              {Number(c.labour_hours) > 0 ? ` · ${Number(c.labour_hours).toFixed(1)}h labour` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0C4A6E" }}>{fmt(c.suggested_price)}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>suggested</div>
          </div>
        </button>
      ))}

      {modalState.open && <CostingModal costing={modalState.costing} onClose={() => setModalState({ open: false })} />}
    </div>
  );
}
