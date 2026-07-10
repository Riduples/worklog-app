import { fmt } from "@/lib/format";
import type { QuoteLineItem } from "@/lib/supabase/hooks/useQuotes";

export function SalesLineItemsEditor({
  items,
  onChange,
}: {
  items: QuoteLineItem[];
  onChange: (items: QuoteLineItem[]) => void;
}) {
  const updateItem = (index: number, changes: Partial<QuoteLineItem>) => {
    onChange(items.map((it, i) => (i === index ? { ...it, ...changes } : it)));
  };
  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));
  const addItem = () => onChange([...items, { desc: "", qty: 1, labour: 0, materials: 0 }]);

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
      {items.map((item, i) => {
        const lineTotal = Number(item.labour || 0) + Number(item.materials || 0);
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
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
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>Labour</div>
                <input
                  type="number"
                  value={item.labour}
                  onChange={(e) => updateItem(i, { labour: parseFloat(e.target.value) || 0 })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>Materials</div>
                <input
                  type="number"
                  value={item.materials}
                  onChange={(e) => updateItem(i, { materials: parseFloat(e.target.value) || 0 })}
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
          border: "1.5px dashed #d1fae5",
          background: "#f0fdf4",
          color: "#166534",
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
