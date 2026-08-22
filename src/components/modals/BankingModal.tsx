"use client";

import { useState } from "react";
import { IncomeModal } from "@/components/modals/IncomeModal";
import { ExpenseModal } from "@/components/modals/ExpenseModal";
import { TransferModal } from "@/components/modals/TransferModal";
import { useBankAccounts } from "@/lib/supabase/hooks/useBankAccounts";
import { useAccountTransfers } from "@/lib/supabase/hooks/useAccountTransfers";
import { useIncome } from "@/lib/supabase/hooks/useIncome";
import { useExpenses } from "@/lib/supabase/hooks/useExpenses";
import type { BankingTx } from "@/lib/banking";

/**
 * The one entry form, and the switch that decides what it is.
 *
 * This is a controller, not a fifth form: each type renders the modal that
 * already knows how to save it, with the switch injected above its first field.
 * That matters more than it looks. The VAT arithmetic, the tax jar, the invoice
 * and bill matchers, the personal-money rule — all of it is delicate and all of
 * it is already tested where it lives. Copying it into one big form to make the
 * screen look unified would be duplicating the exact code that must not drift.
 *
 * Switching type remounts the form, and should: the fields genuinely differ, and
 * carrying a half-typed customer across to a transfer would be carrying a value
 * with nowhere to go.
 */
type TxType = "in" | "out" | "transfer" | "other-in" | "other-out";

const TYPES: { id: TxType; icon: string; label: string }[] = [
  { id: "in", icon: "💰", label: "Money in" },
  { id: "out", icon: "💸", label: "Money out" },
  { id: "transfer", icon: "🔄", label: "Transfer" },
  { id: "other-in", icon: "🏷️", label: "Other" },
];

/** Which of the four buttons is lit for a given state. */
const buttonFor = (t: TxType): TxType => (t === "other-out" ? "other-in" : t);

export function BankingModal({ tx, onClose }: { tx?: BankingTx | null; onClose: () => void }) {
  const { data: accounts } = useBankAccounts();
  const { data: income } = useIncome();
  const { data: expenses } = useExpenses();
  const { data: transfers } = useAccountTransfers();

  // Editing opens on the type the row already is, and the switch is hidden —
  // a saved receipt cannot become a transfer, because they live in different
  // tables. Delete it and log it again if that is really what was meant.
  const initial: TxType = tx
    ? tx.kind === "transfer"
      ? "transfer"
      : tx.allocation === "unallocated" || tx.allocation === "categorised"
        ? tx.kind === "in"
          ? "other-in"
          : "other-out"
        : tx.kind === "in"
          ? "in"
          : "out"
    : "in";
  const [type, setType] = useState<TxType>(initial);
  const isEdit = !!tx;

  const existingIncome = tx?.source === "income" ? (income ?? []).find((r) => r.id === tx.id) ?? null : null;
  const existingExpense = tx?.source === "expense" ? (expenses ?? []).find((r) => r.id === tx.id) ?? null : null;
  // Without this the tapped transfer opened a BLANK form, and saving it logged a
  // second transfer instead of correcting the first.
  const existingTransfer = tx?.source === "transfer" ? (transfers ?? []).find((r) => r.id === tx.id) ?? null : null;

  const isOther = type === "other-in" || type === "other-out";

  const banner = isEdit ? null : (
    <>
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
        What kind of movement?
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 12 }}>
        {TYPES.map((t) => {
          const on = buttonFor(type) === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => setType(t.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "10px 4px",
                borderRadius: 12,
                border: `1.5px solid ${on ? "#0C4A6E" : "#e2e8f0"}`,
                background: on ? "#0C4A6E" : "#fff",
                color: on ? "#fff" : "#334155",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 16 }} aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Other is the only type that still needs its direction asked, because
          "no customer, no supplier, no document" says nothing about which way the
          money went. Bank charges out, interest in. */}
      {isOther && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {([
              ["other-in", "💰 Money in"],
              ["other-out", "💸 Money out"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={type === id}
                onClick={() => setType(id)}
                style={{
                  flex: 1,
                  padding: "9px 10px",
                  borderRadius: 20,
                  border: `1.5px solid ${type === id ? "#0C4A6E" : "#e2e8f0"}`,
                  background: type === id ? "#0C4A6E" : "#fff",
                  color: type === id ? "#fff" : "#374151",
                  fontSize: 12.5,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            style={{
              background: "#F0F9FF",
              border: "1.5px solid #BAE6FD",
              borderRadius: 12,
              padding: "11px 13px",
              marginBottom: 14,
              fontSize: 11.5,
              color: "#0C4A6E",
              lineHeight: 1.55,
            }}
          >
            Money with no customer, no supplier and no document behind it — bank charges, interest received, a refund
            from nowhere. Just say where it belongs on your Profit &amp; Loss.
          </div>
        </>
      )}
    </>
  );

  if (type === "transfer") {
    return <TransferModal accounts={accounts ?? []} banner={banner} existing={existingTransfer} onClose={onClose} />;
  }

  if (type === "in" || type === "other-in") {
    return <IncomeModal banner={banner} variant={isOther ? "other" : "full"} existing={existingIncome} onClose={onClose} />;
  }

  return <ExpenseModal banner={banner} variant={isOther ? "other" : "full"} existing={existingExpense} onClose={onClose} />;
}
