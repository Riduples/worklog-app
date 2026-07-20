/**
 * The correctness core of offline capture — no IndexedDB, no network, no
 * browser. Pure decisions, so they can be tested exhaustively, because this is
 * the code that decides whether someone's income gets entered once, twice, or
 * not at all.
 *
 * The whole scheme rests on one idea: every row carries an id we mint on the
 * phone, not one the database assigns. So replaying a queued write is safe — if
 * the first attempt actually landed before the connection dropped, the replay
 * collides on that id (Postgres 23505) and we know the money is already in,
 * rather than entering it a second time.
 */

/** A write's fate, decided from the error it raised (or didn't). */
export type WriteOutcome =
  | "network" // never reached the server — nothing was written, keep it and retry
  | "duplicate" // our client id already exists — a prior attempt landed it, treat as done
  | "reject"; // the server processed it and refused — replaying won't change the answer

/**
 * A durable, replayable write. The row is fully resolved at capture time —
 * business_id, user_id, the client id, every column — precisely so the flush
 * needs no database lookup (getCurrentBusinessId would fail offline).
 */
export type OutboxItem = {
  id: string; // the client-minted row id; also the outbox key
  table: string; // e.g. "income", "expenses"
  row: Record<string, unknown>; // the complete insert payload, id included
  createdAt: number; // for oldest-first draining
  attempts: number;
  failedReason?: string; // set only once outcome is "reject"
};

/**
 * Reads an insert error and says what to do about it.
 *
 *   23505 (unique_violation)  -> duplicate: our id is already in the table, so a
 *                                previous attempt succeeded. Not a failure.
 *   any other SQLSTATE        -> reject: the server answered (RLS 42501, a check
 *                                constraint, a not-null). Replaying gets the same
 *                                answer, so surface it instead of looping.
 *   no SQLSTATE at all         -> network: postgrest never got a structured reply,
 *                                so we never reached the server. Nothing was
 *                                written; keep it and try later.
 *
 * Deliberately keyed on the presence and value of a SQLSTATE code, not on
 * navigator.onLine (which reports "online" on wifi with no internet) and not on
 * error message text (which varies by browser and locale).
 */
export function classifyWriteError(error: unknown): WriteOutcome {
  const code = readCode(error);

  if (code === "23505") return "duplicate";

  // Postgres SQLSTATEs are exactly five characters, [0-9A-Z]. Their presence
  // means the request reached Postgres and came back with a verdict.
  if (/^[0-9A-Z]{5}$/.test(code)) return "reject";

  return "network";
}

function readCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string") return code;
    if (typeof code === "number") return String(code);
  }
  return "";
}

/**
 * Runs one queued write and reports what happened to it, so the caller (the
 * flusher) can decide whether to drop it, keep it, or flag it — without knowing
 * anything about Postgres error codes.
 *
 * `send` does the actual insert and throws on failure. A clean return and a
 * duplicate both mean "the row is in the table", which is the only thing the
 * outbox cares about.
 */
export async function resolveOutboxItem(
  item: OutboxItem,
  send: (item: OutboxItem) => Promise<void>
): Promise<"synced" | "keep" | "failed"> {
  try {
    await send(item);
    return "synced";
  } catch (error) {
    switch (classifyWriteError(error)) {
      case "duplicate":
        return "synced"; // already landed — the retry was redundant, not wrong
      case "network":
        return "keep"; // still offline / still failing to reach the server
      case "reject":
        return "failed"; // the server refused it; don't loop, tell the user
    }
  }
}

/**
 * A row's identity, minted on the device. Supplying our own id (the tables
 * default to gen_random_uuid(), but accept an explicit one) is what makes the
 * whole replay-safe scheme work.
 */
export function newClientId(): string {
  return crypto.randomUUID();
}
