"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { fmt } from "@/lib/format";
import { useCreateStockItem, useUpdateStockItem, type StockItem } from "@/lib/supabase/hooks/useStock";

export function StockModal({ item, onClose }: { item?: StockItem; onClose: () => void }) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name ?? "");
  const [qty, setQty] = useState(String(item?.qty ?? 0));
  const [cost, setCost] = useState(String(item?.cost_price ?? 0));
  const [sell, setSell] = useState(String(item?.sell_price ?? 0));
  const [reorder, setReorder] = useState(String(item?.reorder_level ?? 0));
  const [error, setError] = useState("");

  const createStockItem = useCreateStockItem();
  const updateStockItem = useUpdateStockItem();
  const saving = createStockItem.isPending || updateStockItem.isPending;

  const costNum = parseFloat(cost) || 0;
  const sellNum = parseFloat(sell) || 0;
  const marginPct = sellNum > 0 ? ((sellNum - costNum) / sellNum) * 100 : 0;

  const handleSave = () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setError("");

    const changes = {
      name: name.trim(),
      qty: parseInt(qty, 10) || 0,
      cost_price: costNum,
      sell_price: sellNum,
      reorder_level: parseInt(reorder, 10) || 0,
      margin_pct: marginPct,
    };

    if (isEdit) {
      updateStockItem.mutate({ id: item.id, changes }, { onSuccess: onClose });
    } else {
      createStockItem.mutate(changes, { onSuccess: onClose });
    }
  };

  return (
    <Modal title={isEdit ? "Edit stock item" : "Add stock item"} onClose={onClose}>
      <Field label="Name">
        <Input value={name} onChange={setName} placeholder="e.g. Cement 50kg" autoFocus />
      </Field>
      <Field label="Quantity on hand">
        <Input value={qty} onChange={setQty} type="number" placeholder="0" />
      </Field>
      <Field label="Cost price (what you pay)">
        <Input value={cost} onChange={setCost} type="number" placeholder="0.00" />
      </Field>
      <Field label="Sell price (what you charge)">
        <Input value={sell} onChange={setSell} type="number" placeholder="0.00" />
      </Field>
      <Field label="Reorder level (alert threshold)">
        <Input value={reorder} onChange={setReorder} type="number" placeholder="0" />
      </Field>

      {sellNum > 0 && (
        <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#166534" }}>
          Margin: <strong>{marginPct.toFixed(1)}%</strong> ({fmt(sellNum - costNum)} per unit)
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : "Save item"} onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
