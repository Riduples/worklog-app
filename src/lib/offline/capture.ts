"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { classifyWriteError, newClientId } from "./outboxCore";
import { enqueueOutbox } from "./outbox";
import { resolveIdentity } from "./identity";

/** Which tables offline capture is allowed to write. Income and expense only —
 *  everything else (quotes, invoices, POs) needs a server-allocated document
 *  number and so can't be minted on a disconnected phone. */
export type CaptureTable = "income" | "expenses";

export type CaptureResult<T> = {
  /** The row as written — carries the client id, business_id and user_id. */
  row: T & { id: string; business_id: string; user_id: string };
  /** True when the network was unreachable and the row went to the outbox to
   *  sync later; false when it reached the server on this attempt. */
  queued: boolean;
};

/**
 * Write a captured entry that survives a signal blip.
 *
 * The row's id is minted here, on the device, not by Postgres — that's the whole
 * trick. It means the exact same row can be replayed later without risk: if this
 * attempt actually landed before the connection dropped, the replay collides on
 * the id (23505) and we know it's already in, rather than entering it twice.
 *
 *   - reached the server, accepted        -> { queued: false }
 *   - reached the server, it was already   -> { queued: false }  (a prior try landed)
 *     there (duplicate id)
 *   - never reached the server (network)   -> queued to the outbox, { queued: true }
 *   - reached the server, it refused        -> throws (a real validation/RLS error;
 *     (any other SQLSTATE)                     retrying would get the same no)
 *
 * The classification is by SQLSTATE, never by navigator.onLine (which lies on
 * captive wifi) — see classifyWriteError.
 */
export async function captureWrite<T extends Record<string, unknown>>(
  supabase: SupabaseClient<Database>,
  table: CaptureTable,
  fields: T
): Promise<CaptureResult<T>> {
  const id = newClientId();
  // Resolved offline-safe: user id from the cached session, business id from
  // what was last remembered online. Throws only on a first-ever offline use
  // with nothing cached, in which case there's nothing to attribute the row to.
  const identity = await resolveIdentity(supabase);
  const row = { ...fields, id, business_id: identity.businessId, user_id: identity.userId };

  // The typed client can't take a runtime table name; the row is already
  // complete, so this dumb insert runs through the untyped surface.
  //
  // A dropped connection surfaces two different ways depending on the transport:
  // postgrest usually *returns* { error } with no SQLSTATE, but some fetch
  // stacks *throw* a TypeError instead. Catch both, so neither escapes the
  // classifier and the entry can't leak out of offline capture unqueued.
  let error: unknown;
  try {
    ({ error } = await (supabase as SupabaseClient).from(table).insert(row));
  } catch (thrown) {
    error = thrown;
  }
  if (!error) return { row, queued: false };

  switch (classifyWriteError(error)) {
    case "duplicate":
      return { row, queued: false }; // a previous attempt already landed it
    case "network":
      await enqueueOutbox({ id, table, row, createdAt: Date.now(), attempts: 0 });
      return { row, queued: true };
    case "reject":
      throw error; // the server gave a verdict — surface it now, don't queue it
  }
}
