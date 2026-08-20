"use client";

import { useState, type CSSProperties } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { todayStr } from "@/lib/format";
import type { BankAccount } from "@/lib/supabase/hooks/useBankAccounts";
import { useCreateTransfer } from "@/lib/supabase/hooks/useAccountTransfers";

const pill = (on: boolean): CSSProperties => ({
  padding: "8px 14px",
  borderRadius: 20,
  fontSize: 13,
  fontWeight: 600,
  border: `1.5px solid ${on ? "#0C4A6E" : "#e2e8f0"}`,
  background: on ? "#0C4A6E" : "#fff",
  color: on ? "#fff" : "#374151",
  cursor: "pointer",
});

// Moving money between the business's own accounts. Lives on its own so both
// Bank accounts and Banking can open the same form — one implementation of a
// movement that is neither income nor expense and must never reach the P&L.
export function TransferModal({
  accounts,
  banner,
  onClose,
}: {
  accounts: BankAccount[];
  /** Banking's type switch, rendered above the first field. */
  banner?: React.ReactNode;
  onClose: () => void;
}) {
  const create = useCreateTransfer();
  const [fromId, setFromId] = useState<string>(accounts[0]?.id ?? "");
  const [toId, setToId] = useState<string>(accounts[1]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const pickFrom = (id: string) => {
    setFromId(id);
    if (id === toId) setToId(accounts.find((a) => a.id !== id)?.id ?? "");
  };

  const save = () => {
    const amt = parseFloat(amount) || 0;
    if (!fromId || !toId) {
      setError("Pick both accounts.");
      return;
    }
    if (fromId === toId) {
      setError("Choose two different accounts.");
      return;
    }
    if (amt <= 0) {
      setError("Enter an amount.");
      return;
    }
    setError("");
    create.mutate(
      { from_account_id: fromId, to_account_id: toId, amount: amt, transfer_date: date, note: note.trim() || null },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal title="Move money" onClose={onClose}>
      {banner}
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12, lineHeight: 1.5 }}>
        Moving money between your own accounts. This isn&apos;t income or expense — it just shifts each account&apos;s balance.
      </div>
      <Field label="From">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {accounts.map((a) => (
            <button key={a.id} type="button" onClick={() => pickFrom(a.id)} style={pill(fromId === a.id)}>
              {a.name}
            </button>
          ))}
        </div>
      </Field>
      <Field label="To">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={a.id === fromId}
              onClick={() => setToId(a.id)}
              style={{ ...pill(toId === a.id), opacity: a.id === fromId ? 0.4 : 1, cursor: a.id === fromId ? "default" : "pointer" }}
            >
              {a.name}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Amount">
        <Input value={amount} onChange={setAmount} type="number" placeholder="0.00" autoFocus />
      </Field>
      <Field label="Date">
        <Input value={date} onChange={setDate} type="date" />
      </Field>
      <Field label="Note - optional">
        <Input value={note} onChange={setNote} placeholder="e.g. moved to savings" />
      </Field>
      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={create.isPending ? "Saving..." : "Move money"} onClick={save} disabled={create.isPending} />
    </Modal>
  );
}
