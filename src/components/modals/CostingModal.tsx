"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { fmt } from "@/lib/format";
import { itemTypeMeta } from "@/lib/itemTypes";
import { useStockItems, useCreateStockItem } from "@/lib/supabase/hooks/useStock";
import { useCreateCosting, useUpdateCosting, type Costing, type CostingLine, type CostingLineKind } from "@/lib/supabase/hooks/useCostings";
import { round2 } from "@/lib/creditNotes";

// The three costing sections, shown in this order to match worklog v126.
const SECTIONS: { kind: CostingLineKind; icon: string; title: string; addLabel: string; descPlaceholder: string }[] = [
  { kind: "material", icon: "🧱", title: "Materials / ingredients", addLabel: "+ Add material", descPlaceholder: "Description" },
  { kind: "product", icon: "📦", title: "Products", addLabel: "+ Add product", descPlaceholder: "Description" },
  { kind: "labour", icon: "⚒️", title: "Labour", addLabel: "+ Add labour line", descPlaceholder: "Description" },
];

const emptyLine = (kind: CostingLineKind): CostingLine => ({ kind, desc: "", qty: kind === "labour" ? 0 : 1, unit_cost: 0 });

const sectionHeading: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#0C4A6E",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  margin: "18px 0 10px",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const addButton: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 12,
  border: "1.5px dashed #cbd5e1",
  background: "#fff",
  color: "#334155",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const cardInput: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1.5px solid #e2e8f0",
  background: "#f8fafc",
  fontSize: 14,
  color: "#111",
  boxSizing: "border-box",
  outline: "none",
};

export function CostingModal({ costing, onClose }: { costing?: Costing; onClose: () => void }) {
  const isEdit = !!costing;
  const [name, setName] = useState(costing?.name ?? "");
  const [notes, setNotes] = useState(costing?.notes ?? "");
  const [units, setUnits] = useState(String(costing?.units ?? 1));
  const [unitLabel, setUnitLabel] = useState(costing?.unit_label ?? "job");
  const [lines, setLines] = useState<CostingLine[]>(() => {
    const existing = (costing?.lines as CostingLine[] | null) ?? null;
    return existing && existing.length ? existing : [emptyLine("material"), emptyLine("product"), emptyLine("labour")];
  });
  const [markup, setMarkup] = useState(String(costing?.markup_pct ?? 30));
  const [error, setError] = useState("");
  const [savedToList, setSavedToList] = useState(false);

  const { data: stock } = useStockItems();
  const createCosting = useCreateCosting();
  const updateCosting = useUpdateCosting();
  const createStockItem = useCreateStockItem();
  const saving = createCosting.isPending || updateCosting.isPending;

  const markupNum = parseFloat(markup) || 0;
  const unitsNum = Math.max(parseFloat(units) || 1, 1);
  const totalCost = round2(lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0));
  const labourHours = round2(lines.filter((l) => l.kind === "labour").reduce((s, l) => s + (Number(l.qty) || 0), 0));
  const suggestedPrice = round2(totalCost * (1 + markupNum / 100));

  const updateLine = (i: number, changes: Partial<CostingLine>) => setLines(lines.map((l, idx) => (idx === i ? { ...l, ...changes } : l)));
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const addLine = (kind: CostingLineKind) => setLines([...lines, emptyLine(kind)]);

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
      units: unitsNum,
      unit_label: unitLabel.trim() || "job",
      notes: notes.trim() || null,
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
        cost_price: round2(totalCost / unitsNum),
        sell_price: round2(suggestedPrice / unitsNum),
        reorder_level: 0,
        margin_pct: suggestedPrice > 0 ? round2(((suggestedPrice - totalCost) / suggestedPrice) * 100) : 0,
        estimated_hours: labourHours > 0 ? labourHours : null,
      },
      { onSuccess: () => setSavedToList(true) }
    );
  };

  return (
    <Modal title={isEdit ? "Edit costing" : "New costing"} onClose={onClose}>
      <Field label="Job / product name">
        <Input value={name} onChange={setName} placeholder="e.g. Bathroom renovation, Chicken curry ×10, Full groom package" autoFocus />
      </Field>

      <Field label="Notes / job description (optional)">
        <Textarea value={notes} onChange={setNotes} placeholder="Scope, special requirements, conditions…" rows={3} />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Number of units / portions">
          <Input value={units} onChange={setUnits} type="number" placeholder="1" />
        </Field>
        <Field label="Unit label">
          <Input value={unitLabel} onChange={setUnitLabel} placeholder="job" />
        </Field>
      </div>

      {(stock ?? []).length > 0 && (
        <select
          value=""
          onChange={(e) => {
            const s = (stock ?? []).find((it) => it.id === e.target.value);
            if (!s) return;
            const kind: CostingLineKind = s.item_type === "labour" ? "labour" : s.item_type === "product" ? "product" : "material";
            setLines([...lines, { kind, desc: s.name, qty: 1, unit_cost: Number(s.cost_price || 0) }]);
            e.target.value = "";
          }}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, color: "#334155", background: "#fff", marginBottom: 4, boxSizing: "border-box" }}
        >
          <option value="">Add from your price list…</option>
          {(stock ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {itemTypeMeta(s.item_type).icon} {s.name} — {fmt(s.cost_price)} cost
            </option>
          ))}
        </select>
      )}

      {SECTIONS.map((section) => {
        const rows = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.kind === section.kind);
        return (
          <div key={section.kind}>
            <div style={sectionHeading}>
              <span>{section.icon}</span> {section.title}
            </div>

            {section.kind === "labour"
              ? rows.map(({ l, i }) => {
                  const lineTotal = (Number(l.qty) || 0) * (Number(l.unit_cost) || 0);
                  return (
                    <div key={i} style={{ background: "#f8fafc", borderRadius: 14, padding: 14, marginBottom: 10, border: "1.5px solid #e2e8f0" }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <input value={l.desc} onChange={(e) => updateLine(i, { desc: e.target.value })} placeholder={section.descPlaceholder} style={cardInput} />
                        <button type="button" onClick={() => removeLine(i)} aria-label="Remove line" style={{ background: "#fee2e2", border: "none", borderRadius: 10, padding: "0 14px", color: "#dc2626", cursor: "pointer", fontSize: 14 }}>
                          ✕
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
                        <div>
                          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Hours</div>
                          <input type="number" value={l.qty || ""} onChange={(e) => updateLine(i, { qty: parseFloat(e.target.value) || 0 })} placeholder="0" style={cardInput} />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Rate (R/hr)</div>
                          <input type="number" value={l.unit_cost || ""} onChange={(e) => updateLine(i, { unit_cost: parseFloat(e.target.value) || 0 })} placeholder="0" style={cardInput} />
                        </div>
                        <div style={{ textAlign: "right", paddingBottom: 10 }}>
                          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Line total</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#0C4A6E" }}>{fmt(lineTotal)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              : rows.map(({ l, i }) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <input value={l.desc} onChange={(e) => updateLine(i, { desc: e.target.value })} placeholder={section.descPlaceholder} style={{ ...cardInput, flex: 1 }} />
                    <input type="number" value={l.unit_cost || ""} onChange={(e) => updateLine(i, { unit_cost: parseFloat(e.target.value) || 0, qty: 1 })} placeholder="R cost" style={{ ...cardInput, width: 120, flex: "none" }} />
                    <button type="button" onClick={() => removeLine(i)} aria-label="Remove line" style={{ background: "#fee2e2", border: "none", borderRadius: 10, padding: "0 14px", color: "#dc2626", cursor: "pointer", fontSize: 14 }}>
                      ✕
                    </button>
                  </div>
                ))}

            <button type="button" onClick={() => addLine(section.kind)} style={addButton}>
              {section.addLabel}
            </button>
          </div>
        );
      })}

      <div style={{ marginTop: 20 }}>
        <Field label="Markup % (profit on top of total cost)">
          <Input value={markup} onChange={setMarkup} type="number" placeholder="30" />
        </Field>
      </div>

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
        {unitsNum > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 12, color: "#7DD3FC" }}>Per {unitLabel.trim() || "unit"} ({unitsNum})</span>
            <span style={{ fontSize: 13, color: "#fff", fontWeight: 700 }}>{fmt(round2(suggestedPrice / unitsNum))}</span>
          </div>
        )}
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <SaveBtn label={saving ? "Saving..." : isEdit ? "Update Costing" : "Save Costing"} icon="🧮" onClick={handleSave} disabled={saving} />

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
