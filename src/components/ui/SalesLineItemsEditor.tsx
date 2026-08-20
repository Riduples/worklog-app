import { fmt } from "@/lib/format";
import { LineCategoryPicker } from "@/components/ui/LineCategoryPicker";
import { itemTypeMeta } from "@/lib/itemTypes";
import { salesLineTotal } from "@/lib/lineItems";
import type { QuoteLineItem } from "@/lib/supabase/hooks/useQuotes";
import { useStockItems } from "@/lib/supabase/hooks/useStock";

export function SalesLineItemsEditor({
  items,
  onChange,
  defaultCategory = null,
  defaultCategorySource,
}: {
  items: QuoteLineItem[];
  onChange: (items: QuoteLineItem[]) => void;
  /** The customer's usual revenue heading — seeds every new line, so the common
   *  job needs no category picked at all. Each line stays overridable for the
   *  invoice that mixes labour with a product sale. */
  defaultCategory?: string | null;
  /** Named on the line so an inherited category doesn't read as typed here. */
  defaultCategorySource?: string;
}) {
  const { data: stock } = useStockItems();
  const updateItem = (index: number, changes: Partial<QuoteLineItem>) => {
    onChange(items.map((it, i) => (i === index ? { ...it, ...changes } : it)));
  };
  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));
  // Flagged, never blocked: the document saves either way — the warning below
  // just names what an uncategorised line costs on the reports.
  const uncategorised = items.filter((it) => !it.sars_category).length;
  const addItem = () => onChange([...items, { desc: "", qty: 1, unit_price: 0, sars_category: defaultCategory }]);

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
            // The category comes from the customer, never the item: the same item
            // code can be bought and sold, so a heading stored on the item files
            // the wrong way round as often as the right one.
            onChange([...items, { desc: s.name, qty: 1, unit_price: Number(s.sell_price || 0), est_hours: Number(s.estimated_hours || 0), sars_category: defaultCategory }]);
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
          marginBottom: 10,
        }}
      >
        + Add line item
      </button>

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
            <LineCategoryPicker
              kind="income"
              value={item.sars_category}
              onChange={(sars) => updateItem(i, { sars_category: sars })}
              inheritedFrom={item.sars_category && item.sars_category === defaultCategory ? defaultCategorySource : undefined}
              warnWhenEmpty
            />
            <div style={{ textAlign: "right", fontSize: 12, color: "#64748b", marginTop: 6 }}>Line total: {fmt(lineTotal)}</div>
          </div>
        );
      })}

      {uncategorised > 0 && (
        <div
          style={{
            background: "#fff7ed",
            border: "1.5px solid #fed7aa",
            borderRadius: 12,
            padding: "10px 12px",
            fontSize: 12,
            color: "#92400e",
            lineHeight: 1.5,
          }}
        >
          ⚠️ {uncategorised === 1 ? "1 line has" : `${uncategorised} lines have`} no category.{" "}
          {uncategorised === 1 ? "It" : "They"} will save fine and your totals stay right, but{" "}
          {uncategorised === 1 ? "it lands" : "they land"} under &ldquo;Uncategorised&rdquo; on your Profit &amp;
          Loss instead of a SARS heading. Tap the amber tag on {uncategorised === 1 ? "the line" : "each line"} to
          set {uncategorised === 1 ? "it" : "them"}, or set the customer up with a usual category so every line starts filled in.
        </div>
      )}
    </div>
  );
}
