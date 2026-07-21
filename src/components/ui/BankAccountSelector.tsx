"use client";

import { useBankAccounts } from "@/lib/supabase/hooks/useBankAccounts";

// "all" = combined (the default), otherwise a bank_accounts.id.
export const ALL_ACCOUNTS = "all";
export type AccountFilter = string;

// The lens. Mirrors PeriodSelector: a pill row with an "All accounts" option that
// works exactly like the period "all". Renders nothing for a business with 0–1
// accounts — there's nothing to separate, so single-account users never see it.
export function BankAccountSelector({
  selected,
  onSelect,
}: {
  selected: AccountFilter;
  onSelect: (v: AccountFilter) => void;
}) {
  const { data } = useBankAccounts();
  const accounts = data ?? [];
  if (accounts.length < 2) return null;

  const options = [{ id: ALL_ACCOUNTS, label: "All accounts" }, ...accounts.map((a) => ({ id: a.id, label: a.name }))];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
      {options.map((o) => {
        const on = selected === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id)}
            style={{
              padding: "6px 13px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              border: `1.5px solid ${on ? "#0C4A6E" : "#e2e8f0"}`,
              background: on ? "#0C4A6E" : "#fff",
              color: on ? "#fff" : "#374151",
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
