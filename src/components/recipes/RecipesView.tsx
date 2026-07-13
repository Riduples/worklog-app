"use client";

import { useState } from "react";
import Link from "next/link";
import { useRecipes, useUpdateRecipe, type Recipe } from "@/lib/supabase/hooks/useRecipes";
import { RecipeModal } from "@/components/modals/RecipeModal";
import { fmt } from "@/lib/format";

export function RecipesView() {
  const { data: recipes, isLoading } = useRecipes();
  const updateRecipe = useUpdateRecipe();
  const [modalState, setModalState] = useState<{ open: boolean; recipe?: Recipe }>({ open: false });

  const handleSoftDelete = (id: string) => {
    if (!confirm("Remove this costing?")) return;
    updateRecipe.mutate({ id, changes: { deleted_at: new Date().toISOString() } });
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <Link href="/dashboard" style={{ fontSize: 12, color: "#64748b" }}>
            ← Dashboard
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1B4332", margin: "4px 0 0" }}>Cost Calculator</h1>
        </div>
        <button
          onClick={() => setModalState({ open: true })}
          style={{ background: "#1B4332", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          + New
        </button>
      </div>

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (recipes ?? []).length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No costings yet.</p>
      )}

      {(recipes ?? []).map((r) => (
        <div
          key={r.id}
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
            onClick={() => setModalState({ open: true, recipe: r })}
            style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", flex: 1, padding: 0 }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{r.dish_name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              Cost {fmt(r.cost_per_serving)} / serving · Sell {fmt(r.suggested_price)}
            </div>
          </button>
          <button
            onClick={() => handleSoftDelete(r.id)}
            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 4 }}
            aria-label="Remove costing"
          >
            ✕
          </button>
        </div>
      ))}

      {modalState.open && <RecipeModal recipe={modalState.recipe} onClose={() => setModalState({ open: false })} />}
    </div>
  );
}
