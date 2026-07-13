"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { fmt } from "@/lib/format";
import { useCreateRecipe, useUpdateRecipe, type Recipe, type Ingredient } from "@/lib/supabase/hooks/useRecipes";

export function RecipeModal({ recipe, onClose }: { recipe?: Recipe; onClose: () => void }) {
  const isEdit = !!recipe;
  const [dishName, setDishName] = useState(recipe?.dish_name ?? "");
  const [servings, setServings] = useState(String(recipe?.servings ?? 1));
  const [markup, setMarkup] = useState(String(recipe?.markup_pct ?? 60));
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    (recipe?.ingredients as Ingredient[]) ?? [{ name: "", cost: 0 }]
  );
  const [error, setError] = useState("");

  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const saving = createRecipe.isPending || updateRecipe.isPending;

  const totalCost = ingredients.reduce((s, i) => s + Number(i.cost || 0), 0);
  const servingsNum = parseFloat(servings) || 1;
  const markupNum = parseFloat(markup) || 0;
  const costPerServing = totalCost / servingsNum;
  const suggestedPrice = costPerServing * (1 + markupNum / 100);

  const updateIngredient = (index: number, changes: Partial<Ingredient>) => {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, ...changes } : ing)));
  };

  const handleSave = () => {
    if (!dishName.trim()) {
      setError("Dish name is required.");
      return;
    }
    setError("");

    const payload = {
      dish_name: dishName.trim(),
      servings: servingsNum,
      ingredients: ingredients.filter((i) => i.name || i.cost),
      total_cost: totalCost,
      cost_per_serving: costPerServing,
      suggested_price: suggestedPrice,
      markup_pct: markupNum,
    };

    if (isEdit) {
      updateRecipe.mutate({ id: recipe.id, changes: payload }, { onSuccess: onClose });
    } else {
      createRecipe.mutate(payload, { onSuccess: onClose });
    }
  };

  return (
    <Modal title={isEdit ? "Edit costing" : "New costing"} onClose={onClose}>
      <Field label="Dish / item name">
        <Input value={dishName} onChange={setDishName} placeholder="e.g. Chicken curry" autoFocus />
      </Field>

      <Field label="Servings / units made">
        <Input value={servings} onChange={setServings} type="number" placeholder="1" />
      </Field>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
          Ingredients / costs
        </label>
        {ingredients.map((ing, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              value={ing.name}
              onChange={(e) => updateIngredient(i, { name: e.target.value })}
              placeholder="Ingredient"
              style={{ flex: 2, padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14 }}
            />
            <input
              type="number"
              value={ing.cost}
              onChange={(e) => updateIngredient(i, { cost: parseFloat(e.target.value) || 0 })}
              placeholder="Cost"
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14 }}
            />
            <button
              type="button"
              onClick={() => setIngredients((prev) => prev.filter((_, idx) => idx !== i))}
              style={{ background: "#fee2e2", border: "none", borderRadius: 10, padding: "0 12px", color: "#dc2626", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setIngredients((prev) => [...prev, { name: "", cost: 0 }])}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1.5px dashed #d1fae5", background: "#f0fdf4", color: "#166534", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          + Add ingredient
        </button>
      </div>

      <Field label="Markup %">
        <Input value={markup} onChange={setMarkup} type="number" placeholder="60" />
      </Field>

      <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#166534" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Total cost</span>
          <span>{fmt(totalCost)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Cost per serving</span>
          <span>{fmt(costPerServing)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, marginTop: 6, paddingTop: 6, borderTop: "1.5px solid #bbf7d0" }}>
          <span>Suggested price ({markupNum.toFixed(0)}% markup)</span>
          <span>{fmt(suggestedPrice)}</span>
        </div>
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : "Save costing"} onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
