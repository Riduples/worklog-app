"use client";

import { useQuery } from "@tanstack/react-query";
import { outboxCounts } from "@/lib/offline/outbox";

/**
 * The one piece of offline capture the owner actually sees: a small pill that
 * says how many entries are saved on this phone but not yet on the server.
 *
 * It reads the durable outbox, not react state — so it tells the truth after a
 * reload, which is exactly the moment reassurance matters most ("I logged that
 * sale in the dead spot; is it still safe?"). It hides itself when there's
 * nothing outstanding, so day to day it isn't there at all.
 *
 * Rendered once, app-wide, fixed to the viewport — because a queued entry can
 * finish syncing while the owner is on any screen, not just the one they logged
 * it from. The count comes down on its own as the flusher drains the queue.
 */
export function SyncStatus() {
  const { data } = useQuery({
    queryKey: ["outbox"],
    queryFn: outboxCounts,
    // Device-local read (IndexedDB), no server round-trip — cheap to poll and
    // safe offline. The create hooks and the flusher also invalidate this key,
    // so the poll is only a backstop for progress made between those events.
    refetchInterval: 15_000,
  });

  const pending = data?.pending ?? 0;
  const failed = data?.failed ?? 0;
  if (pending === 0 && failed === 0) return null;

  const attention = failed > 0;
  const text = attention
    ? pending > 0
      ? `${failed} need attention · ${pending} still to sync`
      : `${failed} ${failed === 1 ? "entry needs" : "entries need"} attention`
    : `${pending} ${pending === 1 ? "entry" : "entries"} saved on this phone — syncing`;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "max(16px, env(safe-area-inset-bottom))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        maxWidth: "calc(100vw - 32px)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 14px",
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 600,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: attention ? "#7F1D1D" : "#fff",
        background: attention ? "#FEE2E2" : "#0C4A6E",
        border: attention ? "1.5px solid #FCA5A5" : "1.5px solid rgba(255,255,255,0.14)",
        boxShadow: "0 6px 20px rgba(15,23,42,0.28)",
      }}
    >
      <span aria-hidden style={{ fontSize: 14 }}>{attention ? "⚠️" : "☁️"}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span>
    </div>
  );
}
