"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SarsSuggestionDropdown } from "@/components/ui/SarsSuggestionDropdown";
import { getSarsMatch, getSarsIncomeMatch, findSarsCategory } from "@/lib/sarsCategories";

// A saved SARS category on a record that is not itself money — a price-list item,
// a contact — where the category is set once and reused every time afterwards.
//
// Different from how the Income/Expense modals ask for one. There the "What for?"
// field doubles as the description AND the category search, because a loose cash
// row has nothing else to describe it. Here the record already has a name, so the
// category is its own field: type to search, tap to set, tap the × to clear.
//
// Rows store the `sars` account name because that is what SARS wants to see;
// people read the plain-English `label`. This shows the label and stores the sars
// string, and looks a saved value back up so editing shows the friendly half.

export function SarsCategoryField({
  label,
  kind,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  /** Which list to search: what the business earns, or what it spends on. */
  kind: "income" | "expense";
  /** The stored `sars` string, or null when nothing is set yet. */
  value: string | null;
  onChange: (sars: string | null) => void;
  placeholder?: string;
  hint?: string;
}) {
  const saved = findSarsCategory(value);
  const [text, setText] = useState(saved?.label ?? "");
  const [open, setOpen] = useState(false);

  const suggestions = kind === "income" ? getSarsIncomeMatch(text) : getSarsMatch(text);

  // A value is only really set once it resolves to a real category — free text the
  // user typed but never picked from the list is a half-finished search, not a
  // category, and must not be saved as one.
  const isSet = !!saved;

  return (
    <Field label={label}>
      <div style={{ position: "relative" }}>
        <Input
          value={text}
          onChange={(v) => {
            setText(v);
            setOpen(true);
            // Typing over a set category clears it — the field now shows a search,
            // not the saved answer, and leaving the old value behind would save
            // something the user can no longer see.
            if (isSet) onChange(null);
          }}
          placeholder={placeholder ?? "Type to search categories"}
        />
        {open && (
          <SarsSuggestionDropdown
            suggestions={suggestions}
            onPick={(s) => {
              onChange(s.sars);
              setText(s.label);
              setOpen(false);
            }}
          />
        )}
      </div>

      {isSet ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
            padding: "9px 11px",
            borderRadius: 10,
            background: "#F0F9FF",
            border: "1.5px solid #BAE6FD",
          }}
        >
          <span style={{ fontSize: 12, color: "#0369A1", flex: 1, minWidth: 0, lineHeight: 1.4 }}>
            Files under <strong>{saved.sars}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setText("");
              setOpen(false);
            }}
            aria-label="Clear category"
            style={{
              background: "none",
              border: "none",
              color: "#0369A1",
              cursor: "pointer",
              fontSize: 17,
              lineHeight: 1,
              padding: 2,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      ) : (
        hint && <p style={{ fontSize: 12, color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.45 }}>{hint}</p>
      )}
    </Field>
  );
}
