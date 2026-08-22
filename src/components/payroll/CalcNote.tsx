"use client";

import { useState } from "react";
import type { CalcLine } from "@/lib/payrunCalc";

// The sum behind an auto-filled figure, printed where the figure is.
//
// Nothing the wizard works out for you — days, the daily rate a salary is split
// at, overtime — is presented as a number you must simply believe. Each one comes
// with the line-by-line working, and the field it fills stays editable.
export function CalcNote({
  title,
  lines,
  defaultOpen = false,
  tone = "light",
}: {
  title: string;
  lines: CalcLine[];
  defaultOpen?: boolean;
  tone?: "light" | "dark";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isDark = tone === "dark";
  const palette = isDark
    ? { bg: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.18)", head: "#7DD3FC", label: "#BAE6FD", value: "#fff", minus: "#FDA4AF", note: "#A5C4D8" }
    : { bg: "#f8fafc", border: "#e2e8f0", head: "#0369A1", label: "#64748b", value: "#0C4A6E", minus: "#be123c", note: "#94a3b8" };

  return (
    <div style={{ background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        style={{ width: "100%", background: "none", border: "none", padding: "8px 11px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ fontSize: 11.5, fontWeight: 700, color: palette.head }}>🧮 {title}</span>
        <span style={{ fontSize: 11, color: palette.note }}>{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 11px 9px" }}>
          {lines.map((l, idx) => {
            const isTotal = l.kind === "total";
            return (
              <div
                key={`${l.label}-${idx}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "3px 0",
                  borderTop: isTotal ? `1px solid ${palette.border}` : "none",
                  marginTop: isTotal ? 4 : 0,
                  paddingTop: isTotal ? 6 : 3,
                }}
              >
                <span style={{ fontSize: 11.5, color: l.kind === "note" ? palette.note : palette.label, fontWeight: isTotal ? 700 : 400, lineHeight: 1.4 }}>{l.label}</span>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: isTotal ? 800 : 600,
                    color: l.kind === "minus" ? palette.minus : l.kind === "note" ? palette.note : palette.value,
                    whiteSpace: "nowrap",
                  }}
                >
                  {l.value}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
