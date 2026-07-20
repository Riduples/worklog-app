"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { listOutbox, removeOutbox, markOutboxFailed } from "./outbox";
import { resolveOutboxItem, type OutboxItem } from "./outboxCore";
import { primeIdentity } from "./identity";

/**
 * Drains the outbox whenever there's a chance of connectivity: on the browser's
 * `online` event, when the tab comes back to the foreground, on a slow tick, and
 * once on load to clear anything a previous session left behind. navigator.onLine
 * is not consulted — the trigger to try is "an event that might mean we're back",
 * and the trigger to stop is a write that actually fails.
 *
 * Which query caches to refresh after a synced write. A table not listed still
 * syncs; it just won't auto-refresh a list until the next natural refetch.
 */
const QUERY_KEY_FOR: Record<string, string[]> = {
  income: ["income"],
  expenses: ["expenses"],
};

export function useOfflineSync(): void {
  const queryClient = useQueryClient();
  const flushing = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    // Cache who this device is for, now, while we can reach the server — so a
    // capture made in a later dead spot can be attributed even if it's the
    // first one this session.
    void primeIdentity(supabase);

    // A dynamic-table insert: the row is already complete (id, business_id,
    // user_id and all), so this is a dumb replay. The typed client can't accept
    // a runtime table name, so the replay runs through the untyped surface.
    const send = async (item: OutboxItem) => {
      const { error } = await (supabase as SupabaseClient).from(item.table).insert(item.row);
      if (error) throw error;
    };

    const flush = async () => {
      if (flushing.current) return; // never two drains at once — that risks double sends
      flushing.current = true;
      const refreshed = new Set<string>();
      let changed = false;
      try {
        const items = await listOutbox().catch(() => [] as OutboxItem[]);
        for (const item of items) {
          if (item.failedReason) continue; // parked for the owner to review
          const outcome = await resolveOutboxItem(item, send);
          if (outcome === "synced") {
            await removeOutbox(item.id);
            refreshed.add(item.table);
            changed = true;
          } else if (outcome === "failed") {
            await markOutboxFailed(item.id, "The server refused this entry.");
            changed = true;
          } else {
            // Still can't reach the server. Stop here rather than hammering the
            // rest of the queue; the next trigger resumes from the top. The
            // entry stays queued for as long as the outage lasts — never dropped.
            break;
          }
        }
      } finally {
        flushing.current = false;
        if (changed) {
          for (const table of refreshed) {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY_FOR[table] ?? [table] });
          }
          queryClient.invalidateQueries({ queryKey: ["outbox"] }); // refresh the indicator
        }
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void flush();
    };
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(flush, 30_000);
    void flush(); // clear anything queued before this session started

    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [queryClient]);
}
