"use client";

import { useState, type CSSProperties } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { CSVImportModal } from "@/components/modals/CSVImportModal";
import { fmt, todayStr } from "@/lib/format";
import { accountBalance, movementCount } from "@/lib/accounts";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_META, accountTypeMeta, methodsForAccountType, normaliseAccountType, type AccountType } from "@/lib/accountTypes";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import {
  useBankAccounts,
  useCreateBankAccount,
  useUpdateBankAccount,
  useDeleteBankAccount,
  useHardDeleteBankAccount,
  type BankAccount,
} from "@/lib/supabase/hooks/useBankAccounts";
import { useAccountTransfers, useCreateTransfer, useDeleteTransfer } from "@/lib/supabase/hooks/useAccountTransfers";

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

type Sort = "az" | "balance" | "recent";
type Filter = "all" | AccountType;

export function AccountsView() {
  const { data: accounts, isLoading } = useBankAccounts();
  const { data: income } = useIncome();
  const { data: expenses } = useExpenses();
  const { data: transfers } = useAccountTransfers();
  const deleteTransfer = useDeleteTransfer();
  const deactivate = useDeleteBankAccount();
  const hardDelete = useHardDeleteBankAccount();
  const [editing, setEditing] = useState<BankAccount | "new" | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("az");

  const list = accounts ?? [];
  const inc = income ?? [];
  const exp = expenses ?? [];
  const tfs = transfers ?? [];
  const accountName = (id: string) => list.find((a) => a.id === id)?.name ?? "Closed account";

  // Only offer a pill for a kind the business actually has — a filter that can
  // only ever show nothing is clutter.
  const presentTypes = ACCOUNT_TYPES.filter((t) => list.some((a) => normaliseAccountType(a.account_type) === t));
  const pills: Filter[] = ["all", ...presentTypes];

  const filtered = list.filter((a) => {
    if (filter !== "all" && normaliseAccountType(a.account_type) !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${a.name} ${a.bank_name ?? ""} ${a.account_number ?? ""} ${accountTypeMeta(a.account_type).label}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "balance") return accountBalance(b, inc, exp, tfs) - accountBalance(a, inc, exp, tfs);
    if (sort === "recent") return (b.updated_at ?? b.created_at ?? "").localeCompare(a.updated_at ?? a.created_at ?? "");
    return a.name.localeCompare(b.name);
  });

  // The money across everything showing — the one figure that makes a list of
  // accounts add up to an answer.
  const shownTotal = filtered.reduce((s, a) => s + accountBalance(a, inc, exp, tfs), 0);

  const removeAccount = (a: BankAccount) => {
    const moves = movementCount(a.id, inc, exp, tfs);
    if (moves === 0) {
      if (!confirm(`Delete ${a.name}? Nothing has been logged against it, so it goes for good.`)) return;
      hardDelete.mutate(a.id);
      return;
    }
    if (
      !confirm(
        `${a.name} has ${moves} transaction${moves === 1 ? "" : "s"} against it, so it can't be deleted — deactivate it instead?\n\nIt disappears from every picker, but those transactions stay in your records and still count under "All accounts".`
      )
    )
      return;
    deactivate.mutate(a.id);
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Bank accounts</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setImportOpen(true)}
            style={{ background: "#F0F9FF", color: "#0369A1", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            ⬆ Import
          </button>
          <button
            onClick={() => setEditing("new")}
            style={{ background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + Add
          </button>
        </div>
      </div>

      <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, marginBottom: 18 }}>
        Add each account you use, then tag transactions to them. On the dashboard and reports you can switch between one
        account and all of them combined.
      </p>

      {!isLoading && list.length === 0 && (
        <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "16px", marginBottom: 16, fontSize: 13, color: "#0369A1", lineHeight: 1.5 }}>
          No accounts yet. Add your first — e.g. &quot;FNB Cheque&quot; — and set what it holds today as the opening
          balance. Got a list already? Import brings them in from a spreadsheet.
        </div>
      )}

      {!isLoading && list.length > 0 && (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts..."
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, boxSizing: "border-box", marginBottom: 12, background: "#fff" }}
          />

          {pills.length > 2 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {pills.map((f) => {
                const active = filter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{ padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${active ? "#0C4A6E" : "#e2e8f0"}`, background: active ? "#0C4A6E" : "#fff", color: active ? "#fff" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    {f === "all" ? "All" : `${ACCOUNT_TYPE_META[f].icon} ${ACCOUNT_TYPE_META[f].label}`}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && list.length > 0 && filtered.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No accounts match your search.</p>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 10px 2px", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {filtered.length}
            {filtered.length !== list.length ? ` of ${list.length}` : ""} account{list.length === 1 ? "" : "s"} ·{" "}
            <span style={{ fontWeight: 700, color: shownTotal >= 0 ? "#0C4A6E" : "#dc2626" }}>{fmt(shownTotal)}</span>
          </span>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3, flexShrink: 0 }}>
            {(["az", "balance", "recent"] as const).map((sv) => (
              <button
                key={sv}
                onClick={() => setSort(sv)}
                style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: sort === sv ? "#fff" : "transparent", color: sort === sv ? "#0C4A6E" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: sort === sv ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
              >
                {sv === "az" ? "A–Z" : sv === "balance" ? "Balance" : "Recent"}
              </button>
            ))}
          </div>
        </div>
      )}

      {sorted.map((a) => {
        const balance = accountBalance(a, inc, exp, tfs);
        const meta = accountTypeMeta(a.account_type);
        const moves = movementCount(a.id, inc, exp, tfs);
        return (
          // The Items row: tap the body to open, ✕ to remove — where "remove"
          // means delete on an untouched account and deactivate on a traded one.
          <div
            key={a.id}
            style={{ background: "#fff", borderRadius: 13, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <button
              onClick={() => setEditing(a)}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}
            >
              <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{a.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#0369A1", background: "#F0F9FF", borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap" }}>
                    {meta.icon} {meta.label}
                  </span>
                  {a.is_default && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#92400e", background: "#fff7ed", border: "1px solid #fed7aa", padding: "1px 6px", borderRadius: 6, whiteSpace: "nowrap" }}>
                      Default
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  {a.bank_name ? `${a.bank_name} · ` : ""}
                  {moves === 0 ? "No transactions yet" : `${moves} transaction${moves === 1 ? "" : "s"}`}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, letterSpacing: 0.5 }}>BALANCE</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: balance >= 0 ? "#0C4A6E" : "#dc2626" }}>{fmt(balance)}</div>
              </div>
            </button>
            <button
              onClick={() => removeAccount(a)}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 4 }}
              aria-label={moves === 0 ? `Delete ${a.name}` : `Deactivate ${a.name}`}
              title={moves === 0 ? "Delete — nothing logged against it" : "Deactivate — it has transactions"}
            >
              ✕
            </button>
          </div>
        );
      })}

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

      {editing && (
        <AccountForm
          account={editing === "new" ? null : editing}
          movements={editing === "new" ? 0 : movementCount(editing.id, inc, exp, tfs)}
          onClose={() => setEditing(null)}
        />
      )}
      {showTransfer && <TransferModal accounts={list} onClose={() => setShowTransfer(false)} />}
      {importOpen && <CSVImportModal type="account" onClose={() => setImportOpen(false)} />}
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
      <Field label="Note - optional">
        <Input value={note} onChange={setNote} placeholder="e.g. moved to savings" />
      </Field>
      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={create.isPending ? "Saving..." : "Move money"} onClick={save} disabled={create.isPending} />
    </Modal>
  );
}

function AccountForm({ account, movements, onClose }: { account: BankAccount | null; movements: number; onClose: () => void }) {
  const create = useCreateBankAccount();
  const update = useUpdateBankAccount();
  const deactivate = useDeleteBankAccount();
  const hardDelete = useHardDeleteBankAccount();
  const isEdit = !!account;

  const [name, setName] = useState(account?.name ?? "");
  const [bankName, setBankName] = useState(account?.bank_name ?? "");
  const [accountNumber, setAccountNumber] = useState(account?.account_number ?? "");
  const [type, setType] = useState(account?.account_type ?? "bank");
  const [openingBalance, setOpeningBalance] = useState(account ? String(account.opening_balance) : "");
  const [openingDate, setOpeningDate] = useState(account?.opening_balance_date ?? todayStr());
  const [isDefault, setIsDefault] = useState(account?.is_default ?? false);
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const saving = create.isPending || update.isPending || deactivate.isPending || hardDelete.isPending;
  const canDelete = movements === 0;

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
    /* Ordered the way an account is described: what you call it, what kind it is,
       who it is with and which one, then what it holds. Type sits second because
       it decides what the account can do — including which payment methods Log
       income and Log expense will offer once anything is tagged to it. */
    <Modal title={isEdit ? "Edit account" : "Add account"} onClose={onClose}>
      <Field label="Account name">
        <Input value={name} onChange={setName} placeholder="e.g. FNB Cheque" autoFocus />
      </Field>

      <Field label="Type">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ACCOUNT_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} style={pill(type === t)}>
              {ACCOUNT_TYPE_META[t].icon} {ACCOUNT_TYPE_META[t].label}
            </button>
          ))}
        </div>
      </Field>
      <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 10, padding: "10px 12px", marginTop: -4, marginBottom: 14, fontSize: 11.5, color: "#0369A1", lineHeight: 1.55 }}>
        {accountTypeMeta(type).hint}
        <div style={{ marginTop: 5 }}>
          Tag money to this account and Log income / Log expense will offer:{" "}
          <strong>{methodsForAccountType(type).join(", ")}</strong>.
        </div>
      </div>

      <Field label="Bank - optional">
        <Input value={bankName} onChange={setBankName} placeholder="e.g. FNB" />
      </Field>
      <Field label="Account number - optional">
        <Input value={accountNumber} onChange={setAccountNumber} placeholder="Last 4 digits are enough, e.g. 1234" />
      </Field>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: -4, marginBottom: 12, lineHeight: 1.5 }}>
        Lets Worklog match an uploaded statement to this account automatically.
      </div>

      <Field label="Opening balance">
        <Input value={openingBalance} onChange={setOpeningBalance} type="number" placeholder="0.00" />
      </Field>
      <Field label="As of date">
        <Input value={openingDate} onChange={setOpeningDate} type="date" />
      </Field>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: -4, marginBottom: 12, lineHeight: 1.5 }}>
        What the account held on that date. Money in and out is added from there on to show a running balance — so if
        you are starting today, put in what it holds right now.
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 13, color: "#374151", cursor: "pointer" }}>
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        Use as the default account for new entries
      </label>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : isEdit ? "Save changes" : "Add account"} onClick={save} disabled={saving} />

      {/* Delete only where there is nothing to lose. Once anything points at the
          account, its rows would be orphaned by a delete and every balance built
          on them would lose its name — so a traded account is deactivated, and
          the count says plainly why that is the only option offered. */}
      {isEdit && account && (
        <div style={{ marginTop: 14, borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
          {!confirmRemove ? (
            <button
              onClick={() => setConfirmRemove(true)}
              style={{ width: "100%", background: "#fff", border: "1.5px solid #fecaca", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, color: "#dc2626", cursor: "pointer" }}
            >
              {canDelete ? "Delete this account" : "Deactivate this account"}
            </button>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: "#64748b", marginBottom: 8, lineHeight: 1.5 }}>
                {canDelete ? (
                  <>Nothing has been logged against this account, so deleting it removes it for good.</>
                ) : (
                  <>
                    This account has <strong>{movements}</strong> transaction{movements === 1 ? "" : "s"} against it, so
                    it can&apos;t be deleted. Deactivating hides it from every picker — those transactions stay in your
                    records and still count under &quot;All accounts&quot;.
                  </>
                )}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setConfirmRemove(false)}
                  style={{ flex: 1, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, color: "#64748b", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    canDelete
                      ? hardDelete.mutate(account.id, { onSuccess: onClose })
                      : deactivate.mutate(account.id, { onSuccess: onClose })
                  }
                  disabled={saving}
                  style={{ flex: 1, background: "#dc2626", border: "none", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}
                >
                  {canDelete ? "Delete account" : "Deactivate"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
