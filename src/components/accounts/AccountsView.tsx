"use client";

import { useState, type CSSProperties } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { fmt, todayStr } from "@/lib/format";
import { accountBalance } from "@/lib/accounts";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import {
  useBankAccounts,
  useCreateBankAccount,
  useUpdateBankAccount,
  useDeleteBankAccount,
  type BankAccount,
} from "@/lib/supabase/hooks/useBankAccounts";
import { useAccountTransfers, useCreateTransfer, useDeleteTransfer } from "@/lib/supabase/hooks/useAccountTransfers";

const TYPES: { id: string; label: string }[] = [
  { id: "bank", label: "Bank" },
  { id: "savings", label: "Savings" },
  { id: "credit", label: "Credit card" },
  { id: "cash", label: "Cash" },
  { id: "other", label: "Other" },
];
const typeLabel = (t: string) => TYPES.find((x) => x.id === t)?.label ?? "Bank";

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

export function AccountsView() {
  const { data: accounts } = useBankAccounts();
  const { data: income } = useIncome();
  const { data: expenses } = useExpenses();
  const { data: transfers } = useAccountTransfers();
  const deleteTransfer = useDeleteTransfer();
  const [editing, setEditing] = useState<BankAccount | "new" | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);

  const list = accounts ?? [];
  const inc = income ?? [];
  const exp = expenses ?? [];
  const tfs = transfers ?? [];
  const accountName = (id: string) => list.find((a) => a.id === id)?.name ?? "Closed account";

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <BackLink />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 6px" }}>Bank accounts</h1>
      <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, marginBottom: 18 }}>
        Add each account you use, then tag transactions to them. On the dashboard and reports you can switch between one
        account and all of them combined.
      </p>

      {list.length === 0 && (
        <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "16px", marginBottom: 16, fontSize: 13, color: "#0369A1", lineHeight: 1.5 }}>
          No accounts yet. Add your first — e.g. &quot;FNB Cheque&quot; — and set what it holds today as the opening balance.
        </div>
      )}

      {list.map((a) => {
        const balance = accountBalance(a, inc, exp, tfs);
        return (
          <button
            key={a.id}
            onClick={() => setEditing(a)}
            style={{ width: "100%", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
          >
            <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
                {a.name}
                {a.is_default && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#0369A1", background: "#F0F9FF", border: "1px solid #BAE6FD", padding: "1px 6px", borderRadius: 5, marginLeft: 6 }}>
                    Default
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {typeLabel(a.account_type)}
                {a.bank_name ? ` · ${a.bank_name}` : ""}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, letterSpacing: 0.5 }}>BALANCE</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: balance >= 0 ? "#0C4A6E" : "#dc2626" }}>{fmt(balance)}</div>
            </div>
          </button>
        );
      })}

      <button
        onClick={() => setEditing("new")}
        style={{ width: "100%", background: "#0C4A6E", border: "none", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer", marginTop: 8 }}
      >
        + Add account
      </button>

      {list.length >= 2 && (
        <button
          onClick={() => setShowTransfer(true)}
          style={{ width: "100%", background: "#fff", border: "1.5px solid #0C4A6E", borderRadius: 14, padding: 13, fontSize: 14, fontWeight: 700, color: "#0C4A6E", cursor: "pointer", marginTop: 10 }}
        >
          ↔ Move money between accounts
        </button>
      )}

      {tfs.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Recent transfers
          </div>
          {tfs.slice(0, 8).map((t) => (
            <div key={t.id} style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>
                  {accountName(t.from_account_id)} → {accountName(t.to_account_id)}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  {t.transfer_date}
                  {t.note ? ` · ${t.note}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#0C4A6E" }}>{fmt(Number(t.amount))}</span>
                <button
                  onClick={() => deleteTransfer.mutate(t.id)}
                  title="Delete transfer"
                  style={{ background: "none", border: "none", color: "#cbd5e1", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <AccountForm account={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {showTransfer && <TransferModal accounts={list} onClose={() => setShowTransfer(false)} />}
    </div>
  );
}

function TransferModal({ accounts, onClose }: { accounts: BankAccount[]; onClose: () => void }) {
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
      <Field label="Note (optional)">
        <Input value={note} onChange={setNote} placeholder="e.g. moved to savings" />
      </Field>
      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={create.isPending ? "Saving..." : "Move money"} onClick={save} disabled={create.isPending} />
    </Modal>
  );
}

function AccountForm({ account, onClose }: { account: BankAccount | null; onClose: () => void }) {
  const create = useCreateBankAccount();
  const update = useUpdateBankAccount();
  const del = useDeleteBankAccount();
  const isEdit = !!account;

  const [name, setName] = useState(account?.name ?? "");
  const [bankName, setBankName] = useState(account?.bank_name ?? "");
  const [accountNumber, setAccountNumber] = useState(account?.account_number ?? "");
  const [type, setType] = useState(account?.account_type ?? "bank");
  const [openingBalance, setOpeningBalance] = useState(account ? String(account.opening_balance) : "");
  const [openingDate, setOpeningDate] = useState(account?.opening_balance_date ?? todayStr());
  const [isDefault, setIsDefault] = useState(account?.is_default ?? false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saving = create.isPending || update.isPending || del.isPending;

  const save = () => {
    if (!name.trim()) {
      setError("Give the account a name.");
      return;
    }
    setError("");
    const payload = {
      name: name.trim(),
      bank_name: bankName.trim() || null,
      account_number: accountNumber.trim() || null,
      account_type: type,
      opening_balance: parseFloat(openingBalance) || 0,
      opening_balance_date: openingDate || null,
      is_default: isDefault,
    };
    if (isEdit && account) {
      update.mutate({ id: account.id, changes: payload }, { onSuccess: onClose });
    } else {
      create.mutate(payload, { onSuccess: onClose });
    }
  };

  return (
    <Modal title={isEdit ? "Edit account" : "Add account"} onClose={onClose}>
      <Field label="Account name">
        <Input value={name} onChange={setName} placeholder="e.g. FNB Cheque" autoFocus />
      </Field>
      <Field label="Bank (optional)">
        <Input value={bankName} onChange={setBankName} placeholder="e.g. FNB" />
      </Field>
      <Field label="Account number (optional)">
        <Input value={accountNumber} onChange={setAccountNumber} placeholder="Last 4 digits are enough, e.g. 1234" />
      </Field>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: -4, marginBottom: 12, lineHeight: 1.5 }}>
        Lets Worklog match an uploaded statement to this account automatically.
      </div>
      <Field label="Type">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TYPES.map((t) => (
            <button key={t.id} type="button" onClick={() => setType(t.id)} style={pill(type === t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Balance today (opening balance)">
        <Input value={openingBalance} onChange={setOpeningBalance} type="number" placeholder="0.00" />
      </Field>
      <Field label="As of date">
        <Input value={openingDate} onChange={setOpeningDate} type="date" />
      </Field>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: -4, marginBottom: 12, lineHeight: 1.5 }}>
        Money in and out is added from this date on to show a running balance. Set it to what the account holds today.
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 13, color: "#374151", cursor: "pointer" }}>
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        Use as the default account for new entries
      </label>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : isEdit ? "Save changes" : "Add account"} onClick={save} disabled={saving} />

      {isEdit && account && (
        <div style={{ marginTop: 14, borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ width: "100%", background: "#fff", border: "1.5px solid #fecaca", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, color: "#dc2626", cursor: "pointer" }}
            >
              Close this account
            </button>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: "#64748b", marginBottom: 8, lineHeight: 1.5 }}>
                Closing hides the account. Its transactions stay in your records and still count under &quot;All
                accounts&quot;.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{ flex: 1, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, color: "#64748b", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => del.mutate(account.id, { onSuccess: onClose })}
                  disabled={saving}
                  style={{ flex: 1, background: "#dc2626", border: "none", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}
                >
                  Close account
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
