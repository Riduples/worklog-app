"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { fmt } from "@/lib/format";
import { itemTypeMeta } from "@/lib/itemTypes";
import { useStockItems, useCreateStockItem } from "@/lib/supabase/hooks/useStock";
import { useCreateCosting, useUpdateCosting, type Costing, type CostingLine } from "@/lib/supabase/hooks/useCostings";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function CostingModal({ costing, onClose }: { costing?: Costing; onClose: () => void }) {
  const isEdit = !!costing;
  const [name, setName] = useState(costing?.name ?? "");
  const [lines, setLines] = useState<CostingLine[]>(() => {
    const existing = (costing?.lines as CostingLine[] | null) ?? null;
    return existing && existing.length ? existing : [{ kind: "material", desc: "", qty: 1, unit_cost: 0 }];
  });
  const [markup, setMarkup] = useState(String(costing?.markup_pct ?? 50));
  const [error, setError] = useState("");
  const [savedToList, setSavedToList] = useState(false);

  const { data: stock } = useStockItems();
  const createCosting = useCreateCosting();
  const updateCosting = useUpdateCosting();
  const createStockItem = useCreateStockItem();
  const saving = createCosting.isPending || updateCosting.isPending;

  const markupNum = parseFloat(markup) || 0;
  const totalCost = round2(lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0));
  const labourHours = round2(lines.filter((l) => l.kind === "labour").reduce((s, l) => s + (Number(l.qty) || 0), 0));
  const suggestedPrice = round2(totalCost * (1 + markupNum / 100));

  const updateLine = (i: number, changes: Partial<CostingLine>) => setLines(lines.map((l, idx) => (idx === i ? { ...l, ...changes } : l)));
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const addLine = (kind: "material" | "labour") => setLines([...lines, { kind, desc: "", qty: 1, unit_cost: 0 }]);

  const handleSave = () => {
    if (!name.trim()) {
      setError("Give the costing a name.");
      return;
    }
    setError("");
    const payload = {
      name: name.trim(),
      lines,
      total_cost: totalCost,
      markup_pct: markupNum,
      suggested_price: suggestedPrice,
      labour_hours: labourHours,
    };
    if (isEdit) {
      updateCosting.mutate({ id: costing.id, changes: payload }, { onSuccess: onClose });
    } else {
      createCosting.mutate(payload, { onSuccess: onClose });
    }
  };

  const handleSaveToList = () => {
    createStockItem.mutate(
      {
        name: name.trim() || "Costed item",
        item_type: "product",
        qty: 0,
        cost_price: totalCost,
        sell_price: suggestedPrice,
        reorder_level: 0,
        margin_pct: suggestedPrice > 0 ? round2(((suggestedPrice - totalCost) / suggestedPrice) * 100) : 0,
        estimated_hours: labourHours > 0 ? labourHours : null,
      },
      { onSuccess: () => setSavedToList(true) }
    );
  };

  return (
    <Modal title={isEdit ? "Edit costing" : "New costing"} onClose={onClose}>
      <Field label="What are you costing?">
        <Input value={name} onChange={setName} placeholder="e.g. Bathroom re-tile, Full groom package" autoFocus />
      </Field>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Materials &amp; labour</div>

      {lines.map((line, i) => {
        const lineTotal = (Number(line.qty) || 0) * (Number(line.unit_cost) || 0);
        const isLabour = line.kind === "labour";
        return (
          <div key={i} style={{ background: "#f8fafc", borderRadius: 12, padding: "12px 14px", marginBottom: 10, border: "1.5px solid #e2e8f0" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {(["material", "labour"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => updateLine(i, { kind: k })}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: `1.5px solid ${line.kind === k ? "#0C4A6E" : "#e2e8f0"}`,
                      background: line.kind === k ? "#0C4A6E" : "#fff",
                      color: line.kind === k ? "#fff" : "#64748b",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {k === "material" ? "🧱 Material" : "⚒️ Labour"}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => removeLine(i)} style={{ marginLeft: "auto", background: "#fee2e2", border: "none", borderRadius: 8, padding: "0 12px", color: "#dc2626", cursor: "pointer" }}>
                ✕
              </button>
            </div>
            <input
              value={line.desc}
              onChange={(e) => updateLine(i, { desc: e.target.value })}
              placeholder={isLabour ? "e.g. Plumbing labour" : "e.g. Cement 50kg"}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, marginBottom: 8, boxSizing: "border-box" }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>{isLabour ? "Hours" : "Qty"}</div>
                <input type="number" value={line.qty} onChange={(e) => updateLine(i, { qty: parseFloat(e.target.value) || 0 })} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>{isLabour ? "Rate/hour" : "Unit cost"}</div>
                <input type="number" value={line.unit_cost} onChange={(e) => updateLine(i, { unit_cost: parseFloat(e.target.value) || 0 })} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 12, color: "#64748b", marginTop: 6 }}>Line cost: {fmt(lineTotal)}</div>
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button type="button" onClick={() => addLine("material")} style={{ flex: 1, padding: 10, borderRadius: 10, border: "1.5px dashed #fed7aa", background: "#fff7ed", color: "#b45309", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Material
        </button>
        <button type="button" onClick={() => addLine("labour")} style={{ flex: 1, padding: 10, borderRadius: 10, border: "1.5px dashed #BAE6FD", background: "#F0F9FF", color: "#0369A1", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Labour
        </button>
      </div>

      {(stock ?? []).length > 0 && (
        <select
          value=""
          onChange={(e) => {
            const s = (stock ?? []).find((it) => it.id === e.target.value);
            if (!s) return;
            const kind = s.item_type === "labour" ? "labour" : "material";
            setLines([...lines, { kind, desc: s.name, qty: 1, unit_cost: Number(s.cost_price || 0) }]);
            e.target.value = "";
          }}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, color: "#334155", background: "#fff", marginBottom: 16, boxSizing: "border-box" }}
        >
          <option value="">Add from your price list…</option>
          {(stock ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {itemTypeMeta(s.item_type).icon} {s.name} — {fmt(s.cost_price)} cost
            </option>
          ))}
        </select>
      )}

      <Field label="Markup %">
        <Input value={markup} onChange={setMarkup} type="number" placeholder="50" />
      </Field>

      <div style={{ background: "#0C4A6E", borderRadius: 14, padding: "14px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: "#7DD3FC" }}>Total cost</span>
          <span style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>{fmt(totalCost)}</span>
        </div>
        {labourHours > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "#7DD3FC" }}>Labour hours</span>
            <span style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>{labourHours.toFixed(1)}h</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 8, marginTop: 2 }}>
          <span style={{ fontSize: 14, color: "#38BDF8", fontWeight: 700 }}>Suggested price</span>
          <span style={{ fontSize: 20, color: "#fff", fontWeight: 900 }}>{fmt(suggestedPrice)}</span>
        </div>
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <SaveBtn label={saving ? "Saving..." : isEdit ? "Update costing" : "Save costing"} onClick={handleSave} disabled={saving} />

      <button
        type="button"
        onClick={handleSaveToList}
        disabled={savedToList || createStockItem.isPending || totalCost <= 0}
        style={{
          width: "100%",
          marginTop: 10,
          padding: 13,
          borderRadius: 12,
          border: "1.5px solid #BAE6FD",
          background: savedToList ? "#f0fdf4" : "#F0F9FF",
          color: savedToList ? "#166534" : "#0369A1",
          fontSize: 13,
          fontWeight: 700,
          cursor: savedToList || totalCost <= 0 ? "default" : "pointer",
        }}
      >
        {savedToList ? "✅ Saved to your price list" : "＋ Save as a price-list item"}
      </button>
    </Modal>
  );
}
