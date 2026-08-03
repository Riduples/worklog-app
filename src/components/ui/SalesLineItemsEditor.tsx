import { fmt } from "@/lib/format";
import { itemTypeMeta } from "@/lib/itemTypes";
import { salesLineTotal } from "@/lib/lineItems";
import type { QuoteLineItem } from "@/lib/supabase/hooks/useQuotes";
import { useStockItems } from "@/lib/supabase/hooks/useStock";
import { useCostings, type CostingLine } from "@/lib/supabase/hooks/useCostings";
import { round2 } from "@/lib/creditNotes";

export function SalesLineItemsEditor({
  items,
  onChange,
}: {
  items: QuoteLineItem[];
  onChange: (items: QuoteLineItem[]) => void;
}) {
  const { data: stock } = useStockItems();
  const { data: costings } = useCostings();
  const updateItem = (index: number, changes: Partial<QuoteLineItem>) => {
    onChange(items.map((it, i) => (i === index ? { ...it, ...changes } : it)));
  };
  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));
  const addItem = () => onChange([...items, { desc: "", qty: 1, unit_price: 0 }]);

  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 700,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 6,
        }}
      >
        Line items
      </label>

      {(stock ?? []).length > 0 && (
        <select
          value=""
          onChange={(e) => {
            const s = (stock ?? []).find((it) => it.id === e.target.value);
            if (!s) return;
            onChange([...items, { desc: s.name, qty: 1, unit_price: Number(s.sell_price || 0), est_hours: Number(s.estimated_hours || 0) }]);
            e.target.value = "";
          }}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1.5px solid #e2e8f0",
            fontSize: 14,
            color: "#334155",
            background: "#fff",
            marginBottom: 10,
            boxSizing: "border-box",
          }}
        >
          <option value="">Add from your items…</option>
          {(stock ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {itemTypeMeta(s.item_type).icon} {s.name} — {fmt(s.sell_price)}
            </option>
          ))}
        </select>
      )}
      {(costings ?? []).length > 0 && (
        <select
          value=""
          onChange={(e) => {
            const c = (costings ?? []).find((x) => x.id === e.target.value);
            if (!c) return;
            // A costing's lines are COSTS; mark each up by the costing's markup so
            // the quote/invoice reflects the sell price (their sum = suggested_price).
            // A labour line's qty is hours, which carries onto est_hours.
            const m = 1 + Number(c.markup_pct || 0) / 100;
            const costingLines: QuoteLineItem[] = ((c.lines as CostingLine[]) ?? []).map((ln) => ({
              desc: ln.desc || (ln.kind === "labour" ? "Labour" : "Material"),
              qty: Number(ln.qty || 0),
              unit_price: round2(Number(ln.unit_cost || 0) * m),
              est_hours: ln.kind === "labour" ? Number(ln.qty || 0) : undefined,
            }));
            onChange([...items, ...costingLines]);
            e.target.value = "";
          }}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, color: "#334155", background: "#fff", marginBottom: 10, boxSizing: "border-box" }}
        >
          <option value="">Load from a saved costing…</option>
          {(costings ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              🧮 {c.name} — {fmt(c.suggested_price)}
            </option>
          ))}
        </select>
      )}

      {items.map((item, i) => {
        const lineTotal = salesLineTotal(item);
        return (
          <div
            key={i}
            style={{
              background: "#f8fafc",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 10,
              border: "1.5px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                value={item.desc}
                onChange={(e) => updateItem(i, { desc: e.target.value })}
                placeholder="Description"
                style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14 }}
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                style={{ background: "#fee2e2", border: "none", borderRadius: 10, padding: "0 12px", color: "#dc2626", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>Qty</div>
                <input
                  type="number"
                  value={item.qty}
                  onChange={(e) => updateItem(i, { qty: parseFloat(e.target.value) || 0 })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>Unit price</div>
                <input
                  type="number"
                  value={item.unit_price ?? ""}
                  onChange={(e) => updateItem(i, { unit_price: parseFloat(e.target.value) || 0 })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 12, color: "#64748b", marginTop: 6 }}>Line total: {fmt(lineTotal)}</div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={addItem}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: 10,
          border: "1.5px dashed #BAE6FD",
          background: "#F0F9FF",
          color: "#0369A1",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        + Add line item
      </button>
    </div>
  );
}
