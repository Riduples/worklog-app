"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SetupStepDef, SetupTarget } from "@/lib/setupChecklist";

// "Finish setting up" card. Shows the steps a new business still has to do (each
// ticks itself off from real data), hides once they're all done, and can be
// dismissed by an established owner who doesn't need it. Dismissal is remembered
// per business in localStorage (client-only, like the announcement banner).
export function SetupChecklist({
  businessId,
  steps,
  hrefFor,
  onQuickLog,
}: {
  businessId: string;
  steps: SetupStepDef[];
  hrefFor: (t: Exclude<SetupTarget, "quicklog">) => string;
  onQuickLog: () => void;
}) {
  const storageKey = `worklog-setup-dismissed-${businessId}`;
  const [dismissed, setDismissed] = useState(false);

  // Read the dismissal after mount so the server render (which can't see
  // localStorage) and the first client render agree — no hydration mismatch.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage read: must run post-mount so SSR and first client render agree
      setDismissed(typeof window !== "undefined" && localStorage.getItem(storageKey) === "1");
    } catch {
      /* private mode / disabled storage — just show the card */
    }
  }, [storageKey]);

  const doneCount = steps.filter((s) => s.done).length;
  if (dismissed || doneCount === steps.length) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div style={{ background: "#fff", border: "1.5px solid #BAE6FD", borderRadius: 18, padding: "16px 18px", boxShadow: "0 2px 10px rgba(12,74,110,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0C4A6E" }}>🚀 Finish setting up</div>
        <button
          onClick={dismiss}
          aria-label="Dismiss setup checklist"
          style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: 18, lineHeight: 1, cursor: "pointer", padding: 0 }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
        {doneCount} of {steps.length} done — a few quick steps to get the most out of Worklog.
      </div>
      <div style={{ height: 6, background: "#e2e8f0", borderRadius: 6, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "#0EA5E9", borderRadius: 6, transition: "width 200ms" }} />
      </div>

      {steps.map((s) => {
        const inner = (
          <>
            <span
              aria-hidden
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 900,
                background: s.done ? "#0EA5E9" : "#f1f5f9",
                color: s.done ? "#fff" : "#94a3b8",
                border: s.done ? "none" : "1.5px solid #e2e8f0",
              }}
            >
              {s.done ? "✓" : ""}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: s.done ? "#94a3b8" : "#111", textDecoration: s.done ? "line-through" : "none" }}>
                {s.label}
              </div>
              {!s.done && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{s.hint}</div>}
            </div>
            {!s.done && <span style={{ color: "#0EA5E9", fontWeight: 800, flexShrink: 0 }}>›</span>}
          </>
        );

        const rowStyle: React.CSSProperties = {
          display: "flex",
          alignItems: "center",
          gap: 11,
          width: "100%",
          textAlign: "left",
          padding: "9px 0",
          borderTop: "1px solid #f1f5f9",
          background: "transparent",
          border: "none",
          borderTopWidth: 1,
          borderTopStyle: "solid",
          borderTopColor: "#f1f5f9",
          cursor: s.done ? "default" : "pointer",
          fontFamily: "inherit",
        };

        // Done steps aren't actionable; undone ones link or open Quick Log.
        if (s.done) {
          return (
            <div key={s.key} style={rowStyle}>
              {inner}
            </div>
          );
        }
        if (s.target === "quicklog") {
          return (
            <button key={s.key} type="button" onClick={onQuickLog} style={rowStyle}>
              {inner}
            </button>
          );
        }
        return (
          <Link key={s.key} href={hrefFor(s.target)} style={{ ...rowStyle, textDecoration: "none" }}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
