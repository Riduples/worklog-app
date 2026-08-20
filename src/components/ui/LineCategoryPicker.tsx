"use client";

import { useState } from "react";
import { SarsSuggestionDropdown } from "@/components/ui/SarsSuggestionDropdown";
import { getSarsMatch, getSarsIncomeMatch, findSarsCategory } from "@/lib/sarsCategories";

// The category on a single document line, sized to sit inside a line-item row —
// and, at the other end, the one a customer or supplier is set up with.
//
// A default on the contact gets most documents right, but not one where the stuff
// on it differs — cleaning and stationery bought from the same shop belong under
// two headings, and no per-contact default can know that. So the default seeds
// every line and this overrides it, per line, without making anyone touch a line
// that was already correct.
//
// Collapsed to a single line of text until tapped, because on the common bill
// every line is already right and a row of open search boxes would be noise.

export function LineCategoryPicker({
  kind,
  value,
  onChange,
  inheritedFrom,
  required = false,
}: {
  /** Which list to search: what the business earns, or what it spends on. */
  kind: "income" | "expense";
  /** The stored `sars` string for this line, or null. */
  value: string | null | undefined;
  onChange: (sars: string | null) => void;
  /** Where an unedited value came from, e.g. "this supplier" — shown so an
   *  inherited category doesn't look like something the user typed here. */
  inheritedFrom?: string;
  /** Nothing set is a gap the reports will show as Uncategorised, so say so in
   *  amber rather than offering it as an optional extra. */
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const saved = findSarsCategory(value);
  const suggestions = kind === "income" ? getSarsIncomeMatch(text) : getSarsMatch(text);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setText("");
          setOpen(true);
        }}
        style={{
          width: "100%",
          textAlign: "left",
          marginTop: 6,
          padding: "7px 9px",
          borderRadius: 8,
          border: `1px solid ${saved ? "#BAE6FD" : required ? "#fed7aa" : "#e2e8f0"}`,
          background: saved ? "#F0F9FF" : required ? "#fff7ed" : "#fff",
          color: saved ? "#0369A1" : required ? "#b45309" : "#94a3b8",
          fontSize: 11.5,
          fontWeight: saved || required ? 700 : 500,
          fontFamily: "inherit",
          cursor: "pointer",
          lineHeight: 1.4,
        }}
      >
        {saved ? (
          <>
            🏷️ {saved.label}
            {inheritedFrom && <span style={{ fontWeight: 500, color: "#7dd3fc" }}> · from {inheritedFrom}</span>}
          </>
        ) : required ? (
          "🏷️ Set category — required"
        ) : (
          "🏷️ Set category — optional"
        )}
      </button>
    );
  }

  return (
    <div style={{ position: "relative", marginTop: 6 }}>
      <input
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          // Give a tap on a suggestion time to land before the list closes.
          setTimeout(() => setOpen(false), 150);
        }}
        placeholder={saved ? saved.label : "Type to search categories"}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1.5px solid #BAE6FD",
          fontSize: 12.5,
          boxSizing: "border-box",
        }}
      />
      <SarsSuggestionDropdown
        suggestions={suggestions}
        onPick={(s) => {
          onChange(s.sars);
          setOpen(false);
        }}
      />
      {saved && (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
          style={{
            marginTop: 5,
            background: "none",
            border: "none",
            padding: 0,
            color: "#94a3b8",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Clear category
        </button>
      )}
    </div>
  );
}
