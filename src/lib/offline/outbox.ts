"use client";

import type { OutboxItem } from "./outboxCore";

/**
 * The durable side of the outbox: an IndexedDB store that survives the app
 * closing and the phone restarting. Everything decided here is dumb storage —
 * put, list, remove, flag — because the decisions (what to retry, what's a
 * duplicate, what's a real rejection) live in outboxCore, where they're tested.
 *
 * IndexedDB rather than localStorage: localStorage is synchronous (janks the UI
 * on every write), caps at ~5MB, and holds only strings. A queue of financial
 * entries wants none of those limits. This is the standard tool for the job.
 *
 * Hand-rolled rather than pulling in a wrapper — the surface is one store and
 * four operations, and this keeps the dependency list as tight as the rest of
 * the project.
 */

const DB_NAME = "worklog-offline";
const DB_VERSION = 1;
const STORE = "outbox";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  // Private-browsing and some locked-down webviews disable IndexedDB entirely.
  // Fail loudly here so the caller can fall back to surfacing the write error
  // rather than silently dropping the entry.
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable in this browser"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          // Keyed on the row's client id, so a re-enqueue of the same entry
          // overwrites rather than duplicates.
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

/**
 * Runs one store operation and resolves only when the whole transaction has
 * committed — not merely when the request fired. For a queue whose entire point
 * is durability, "the write is done" has to mean "on disk".
 */
function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = op(tx.objectStore(STORE));
        let result: T | undefined;
        request.onsuccess = () => {
          result = request.result as T;
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error ?? request.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

/** Add or replace a queued write. Same id overwrites — see the keyPath above. */
export function enqueueOutbox(item: OutboxItem): Promise<void> {
  return run("readwrite", (store) => store.put(item)).then(() => undefined);
}

/** Every queued write, oldest first — the order the flusher drains them in. */
export async function listOutbox(): Promise<OutboxItem[]> {
  const all = (await run<OutboxItem[]>("readonly", (store) => store.getAll())) ?? [];
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

/** Drop a write once it has landed (or was already there). */
export function removeOutbox(id: string): Promise<void> {
  return run("readwrite", (store) => store.delete(id)).then(() => undefined);
}

/**
 * Flag a write the server refused, so it stops being retried and can be shown
 * to the owner for review. It stays in the store — a rejected financial entry
 * should never just vanish.
 */
export async function markOutboxFailed(id: string, reason: string): Promise<void> {
  const existing = await run<OutboxItem | undefined>("readonly", (store) => store.get(id));
  if (!existing) return;
  await enqueueOutbox({ ...existing, failedReason: reason });
}

/**
 * What the indicator shows: how many entries are still waiting to sync, and how
 * many were refused and need a look. Derived from the list so there's one source
 * of truth, not a separately-maintained counter that could drift.
 */
export async function outboxCounts(): Promise<{ pending: number; failed: number }> {
  try {
    const items = await listOutbox();
    const failed = items.filter((i) => i.failedReason).length;
    return { pending: items.length - failed, failed };
  } catch {
    // IndexedDB unavailable — nothing is queued because nothing could be.
    return { pending: 0, failed: 0 };
  }
}
