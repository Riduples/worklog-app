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
  const [editing, setEditing] = useState<BankAccount | "new" | null>(null);

  const list = accounts ?? [];
  const inc = income ?? [];
  const exp = expenses ?? [];

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
        const balance = accountBalance(a, inc, exp);
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

      {editing && <AccountForm account={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AccountForm({ account, onClose }: { account: BankAccount | null; onClose: () => void }) {
  const create = useCreateBankAccount();
  const update = useUpdateBankAccount();
  const del = useDeleteBankAccount();
  const isEdit = !!account;

  const [name, setName] = useState(account?.name ?? "");
  const [bankName, setBankName] = useState(account?.bank_name ?? "");
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
