"use client";

import Link from "next/link";
import { Field } from "@/components/ui/Field";
import { useBankAccounts } from "@/lib/supabase/hooks/useBankAccounts";

// Per-transaction "which account did this move through?" picker. value is an
// account id or null (unassigned). Tapping the selected one again clears it.
export function BankAccountPicker({
  value,
  onChange,
  label = "Bank account",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  label?: string;
}) {
  const { data } = useBankAccounts();
  const accounts = data ?? [];

  if (accounts.length === 0) {
    return (
      <Field label={label}>
        <Link href="/accounts" style={{ fontSize: 12, color: "#0369A1", fontWeight: 600 }}>
          + Add a bank account
        </Link>
      </Field>
    );
  }

  return (
    <Field label={label}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {accounts.map((a) => {
          const on = value === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange(on ? null : a.id)}
              style={{
                padding: "9px 14px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                border: `1.5px solid ${on ? "#0C4A6E" : "#e2e8f0"}`,
                background: on ? "#0C4A6E" : "#fff",
                color: on ? "#fff" : "#374151",
                cursor: "pointer",
              }}
            >
              {a.name}
            </button>
          );
        })}
      </div>
    </Field>
  );
}
