"use client";

import { useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { BankingModal } from "@/components/modals/BankingModal";
import { CSVImportModal } from "@/components/modals/CSVImportModal";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { useBankAccounts } from "@/lib/supabase/hooks/useBankAccounts";
import { useBankingTransactions, useDeleteBankingTx, useSetReconciled } from "@/lib/supabase/hooks/useBanking";
import {
  bankingTotals,
  filterBanking,
  sortBanking,
  type BankingKind,
  type BankingSort,
  type BankingTx,
} from "@/lib/banking";
import { fmt } from "@/lib/format";

const KIND_META: Record<BankingKind, { icon: string; label: string; bg: string; fg: string }> = {
  in: { icon: "💰", label: "In", bg: "#BAE6FD", fg: "#0C4A6E" },
  out: { icon: "💸", label: "Out", bg: "#fee2e2", fg: "#dc2626" },
  transfer: { icon: "🔄", label: "Transfer", bg: "#ede9fe", fg: "#6d28d9" },
};

type Pill = "all" | BankingKind | "unallocated" | "unreconciled";

export function BankingView() {
  const access = useToolAccess("income");
  const { rows, isLoading } = useBankingTransactions();
  const { data: accounts } = useBankAccounts();
  const setReconciled = useSetReconciled();
  const removeTx = useDeleteBankingTx();

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<BankingTx | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pill, setPill] = useState<Pill>("all");
  const [sort, setSort] = useState<BankingSort>("date");

  const accountName = (id: string | null | undefined) => (accounts ?? []).find((a) => a.id === id)?.name ?? null;

  const kind: BankingKind | "all" = pill === "in" || pill === "out" || pill === "transfer" ? pill : "all";
  const flag = pill === "unallocated" || pill === "unreconciled" ? pill : null;
  const filtered = sortBanking(filterBanking(rows, { search, kind, flag }, accountName), sort);
  const totals = bankingTotals(filtered);

  const unallocatedCount = rows.filter((r) => r.allocation === "unallocated").length;
  const unreconciledCount = rows.filter((r) => !r.reconciled).length;

  const pills: { id: Pill; label: string; warn?: boolean }[] = [
    { id: "all", label: "All" },
    { id: "in", label: "💰 In" },
    { id: "out", label: "💸 Out" },
    { id: "transfer", label: "🔄 Transfer" },
    ...(unallocatedCount > 0 ? [{ id: "unallocated" as Pill, label: `⚠️ Needs a home ${unallocatedCount}`, warn: true }] : []),
    ...(unreconciledCount > 0 ? [{ id: "unreconciled" as Pill, label: `○ Not reconciled ${unreconciledCount}` }] : []),
  ];

  const remove = (tx: BankingTx) => {
    const what = tx.kind === "transfer" ? "transfer" : `${tx.kind === "in" ? "receipt" : "payment"} of ${fmt(tx.amount)}`;
    if (!confirm(`Remove this ${what}? It comes off your reports. Anything it was matched to stays as it is.`)) return;
    removeTx.mutate({ source: tx.source, id: tx.id });
  };

  const subLine = (tx: BankingTx) => {
    const bits: (string | null)[] = [tx.date];
    if (tx.kind === "transfer") {
      bits.push(`${accountName(tx.fromAccountId) ?? "Account"} → ${accountName(tx.toAccountId) ?? "Account"}`);
    } else {
      bits.push(tx.method);
      bits.push(accountName(tx.accountId));
      bits.push(tx.allocation === "categorised" ? tx.category : null);
      bits.push(tx.allocation === "personal" ? "Personal money" : null);
    }
    return bits.filter(Boolean).join(" · ");
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 10 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Banking</h1>
        </div>
        {access.canEdit && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setImportOpen(true)}
              style={{ background: "#F0F9FF", color: "#0369A1", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              ⬆ Import
            </button>
            <button
              onClick={() => setAddOpen(true)}
              style={{ background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              + Add
            </button>
          </div>
        )}
      </div>

      <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, margin: "10px 0 16px" }}>
        Every rand that moved through your accounts — in, out and between. Tap any row to change it.
      </p>

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="transactions" />}

      {!isLoading && rows.length > 0 && (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions..."
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, boxSizing: "border-box", marginBottom: 12, background: "#fff" }}
          />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {pills.map((p) => {
              const on = pill === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPill(p.id)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 20,
                    border: `1.5px solid ${on ? "#0C4A6E" : p.warn ? "#fed7aa" : "#e2e8f0"}`,
                    background: on ? "#0C4A6E" : p.warn ? "#fff7ed" : "#fff",
                    color: on ? "#fff" : p.warn ? "#b45309" : "#374151",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && rows.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>
          Nothing logged yet. Tap <strong>+ Add</strong> for one, or <strong>Import</strong> to bring a statement in.
        </p>
      )}
      {!isLoading && rows.length > 0 && filtered.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No transactions match your search.</p>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 10px 2px", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {filtered.length}
            {filtered.length !== rows.length ? ` of ${rows.length}` : ""} transaction{rows.length === 1 ? "" : "s"} · net{" "}
            <span style={{ fontWeight: 700, color: totals.net >= 0 ? "#0C4A6E" : "#dc2626" }}>
              {totals.net >= 0 ? "+" : "−"}
              {fmt(Math.abs(totals.net))}
            </span>
            {totals.transfers > 0 && <span> · {fmt(totals.transfers)} moved</span>}
          </span>
          <div style={{ display: "flex", gap: 3, background: "#f1f5f9", borderRadius: 10, padding: 3, flexShrink: 0 }}>
            {(["date", "amount", "az"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{ padding: "5px 9px", borderRadius: 8, border: "none", background: sort === s ? "#fff" : "transparent", color: sort === s ? "#0C4A6E" : "#64748b", fontSize: 11.5, fontWeight: 700, cursor: "pointer", boxShadow: sort === s ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
              >
                {s === "date" ? "Date" : s === "amount" ? "Amount" : "A–Z"}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isLoading &&
        filtered.map((tx) => {
          const meta = KIND_META[tx.kind];
          const needsHome = tx.allocation === "unallocated";
          return (
            <div
              key={tx.key}
              style={{
                background: "#fff",
                borderRadius: 13,
                padding: "11px 13px",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 11,
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                border: needsHome ? "1.5px solid #fed7aa" : "1.5px solid transparent",
              }}
            >
              <div
                aria-hidden
                style={{ width: 34, height: 34, borderRadius: 10, background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}
              >
                {meta.icon}
              </div>

              <button
                onClick={() => setEditing(tx)}
                style={{ background: "none", border: "none", padding: 0, textAlign: "left", flex: 1, minWidth: 0, cursor: "pointer" }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#111", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  <span>
                    {tx.kind === "transfer"
                      ? `${accountName(tx.fromAccountId) ?? "Account"} → ${accountName(tx.toAccountId) ?? "Account"}`
                      : tx.party || tx.description || (tx.kind === "in" ? "Money in" : "Money out")}
                  </span>
                  {tx.docLabel && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: "#0369A1", background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 6, padding: "1px 5px", whiteSpace: "nowrap" }}>
                      {tx.docLabel}
                    </span>
                  )}
                  {needsHome && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: "#b45309", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 6, padding: "1px 5px", whiteSpace: "nowrap" }}>
                      Needs a home
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 1 }}>{subLine(tx)}</div>
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: meta.fg, fontVariantNumeric: "tabular-nums" }}>
                  {tx.kind === "in" ? "+" : tx.kind === "out" ? "−" : ""}
                  {fmt(tx.amount)}
                </span>
                {access.canEdit && (
                  <button
                    onClick={() => setReconciled.mutate({ source: tx.source, id: tx.id, reconciled: !tx.reconciled })}
                    title={tx.reconciled ? "Agreed to your bank statement — tap to undo" : "Not yet agreed to your bank statement"}
                    aria-label={tx.reconciled ? "Mark as not reconciled" : "Mark as reconciled"}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 2, color: tx.reconciled ? "#166534" : "#cbd5e1" }}
                  >
                    {tx.reconciled ? "✓" : "○"}
                  </button>
                )}
                {access.canDelete && (
                  <button
                    onClick={() => remove(tx)}
                    aria-label="Remove transaction"
                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 2 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}

      {(addOpen || editing) && (
        <BankingModal
          tx={editing}
          onClose={() => {
            setAddOpen(false);
            setEditing(null);
          }}
        />
      )}
      {importOpen && <CSVImportModal type="banking" onClose={() => setImportOpen(false)} />}
    </div>
  );
}
