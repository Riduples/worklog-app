"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { SarsCategoryField } from "@/components/ui/SarsCategoryField";
import { fmt } from "@/lib/format";
import { ITEM_TYPES, ITEM_TYPE_META, type ItemType } from "@/lib/itemTypes";
import { useCreateStockItem, useUpdateStockItem, type StockItem } from "@/lib/supabase/hooks/useStock";

export function StockModal({ item, onClose }: { item?: StockItem; onClose: () => void }) {
  const isEdit = !!item;
  const [itemType, setItemType] = useState<ItemType>((item?.item_type as ItemType) ?? "service");
  const [name, setName] = useState(item?.name ?? "");
  const [qty, setQty] = useState(String(item?.qty ?? 0));
  const [cost, setCost] = useState(String(item?.cost_price ?? 0));
  const [sell, setSell] = useState(String(item?.sell_price ?? 0));
  const [reorder, setReorder] = useState(String(item?.reorder_level ?? 0));
  const [sarsCategory, setSarsCategory] = useState<string | null>(item?.sars_category ?? null);
  const [error, setError] = useState("");

  const createStockItem = useCreateStockItem();
  const updateStockItem = useUpdateStockItem();
  const saving = createStockItem.isPending || updateStockItem.isPending;

  const meta = ITEM_TYPE_META[itemType];
  const costNum = parseFloat(cost) || 0;
  const sellNum = parseFloat(sell) || 0;
  const marginPct = sellNum > 0 ? ((sellNum - costNum) / sellNum) * 100 : 0;

  const handleSave = () => {
    if (!name.trim()) {
      setError("Description is required.");
      return;
    }
    setError("");

    const changes = {
      name: name.trim(),
      item_type: itemType,
      qty: meta.showStock ? parseInt(qty, 10) || 0 : 0,
      cost_price: costNum,
      sell_price: sellNum,
      reorder_level: meta.showStock ? parseInt(reorder, 10) || 0 : 0,
      margin_pct: marginPct,
      sars_category: sarsCategory,
    };

    if (isEdit) {
      updateStockItem.mutate({ id: item.id, changes }, { onSuccess: onClose });
    } else {
      createStockItem.mutate(changes, { onSuccess: onClose });
    }
  };

  return (
    <Modal title={isEdit ? "Edit stock item" : "Add stock item"} onClose={onClose}>
      {item?.source_costing_id && (
        <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 12, padding: "10px 12px", marginBottom: 16, fontSize: 12, color: "#0369A1", lineHeight: 1.45 }}>
          🧮 Priced from a costing in the Cost Calculator. Refreshing that costing will overwrite the price here — edit it there to keep them in sync.
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 700,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginBottom: 8,
          }}
        >
          Type — what kind of item is this?
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {ITEM_TYPES.map((t) => {
            const m = ITEM_TYPE_META[t];
            const active = itemType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setItemType(t)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "13px 10px",
                  borderRadius: 12,
                  border: active ? "1.5px solid #0C4A6E" : "1.5px solid #e2e8f0",
                  background: active ? "#0C4A6E" : "#fff",
                  color: active ? "#fff" : "#1e293b",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <span>{m.icon}</span>
                {m.label}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 13, color: "#64748b", margin: "10px 0 0" }}>{meta.hint}</p>
      </div>

      <Field label="Description">
        <Input value={name} onChange={setName} placeholder={meta.placeholder} autoFocus />
      </Field>

      {meta.showStock && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Qty in stock">
            <Input value={qty} onChange={setQty} type="number" placeholder="0" />
          </Field>
          <Field label="Reorder below">
            <Input value={reorder} onChange={setReorder} type="number" placeholder="0" />
          </Field>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label={meta.costLabel}>
          <Input value={cost} onChange={setCost} type="number" placeholder="0.00" />
        </Field>
        <Field label={meta.sellLabel}>
          <Input value={sell} onChange={setSell} type="number" placeholder="0.00" />
        </Field>
      </div>

      {sellNum > 0 && (
        <div style={{ background: "#F0F9FF", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#0369A1" }}>
          Margin: <strong>{marginPct.toFixed(1)}%</strong> ({fmt(sellNum - costNum)} per unit)
        </div>
      )}

      {/* Set once here and every quote and invoice line for this item inherits it,
          so nobody picks a category while invoicing — and an invoice mixing labour
          and materials still carries both, because they arrive per line. */}
      <SarsCategoryField
        label="Income category — optional"
        kind="income"
        value={sarsCategory}
        onChange={setSarsCategory}
        placeholder="e.g. service, product sale, consulting"
        hint="Where sales of this item land on your Profit & Loss. Set it once and every invoice line for this item files itself."
      />

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : isEdit ? "Save changes" : meta.addLabel} icon={meta.icon} onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
