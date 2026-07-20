import { describe, expect, it, vi } from "vitest";
import { classifyWriteError, resolveOutboxItem, newClientId, type OutboxItem } from "./outboxCore";

// Supabase surfaces a PostgrestError shape: { code, message, details, hint }.
// A real network failure has no code — postgrest never got a structured reply.
const pgError = (code: string, message = "") => ({ code, message, details: null, hint: null });
const networkError = (message = "TypeError: Failed to fetch") => ({ message, name: "TypeError" }); // no code

describe("classifyWriteError", () => {
  it("calls a unique-violation on our own id a duplicate, not a failure", () => {
    // The keystone: 23505 means a prior attempt already inserted this row, so
    // the replay is redundant. Getting this wrong double-enters money.
    expect(classifyWriteError(pgError("23505"))).toBe("duplicate");
  });

  it("treats any other SQLSTATE as a reject — the server gave a verdict", () => {
    expect(classifyWriteError(pgError("42501"))).toBe("reject"); // RLS insufficient_privilege
    expect(classifyWriteError(pgError("23502"))).toBe("reject"); // not_null_violation
    expect(classifyWriteError(pgError("23514"))).toBe("reject"); // check_violation
    expect(classifyWriteError(pgError("22P02"))).toBe("reject"); // invalid_text_representation
  });

  it("treats a missing code as network — we never reached the server", () => {
    expect(classifyWriteError(networkError())).toBe("network");
    expect(classifyWriteError(networkError("NetworkError when attempting to fetch resource"))).toBe("network");
    expect(classifyWriteError(networkError("Load failed"))).toBe("network"); // Safari's wording
    expect(classifyWriteError({ name: "AbortError", message: "aborted" })).toBe("network");
  });

  it("does not mistake message text for a verdict — only the code decides", () => {
    // A network error whose message happens to contain a number, or a reject
    // whose message is empty, must still be classified by code alone.
    expect(classifyWriteError({ message: "failed after 23505ms" })).toBe("network"); // no code field
    expect(classifyWriteError(pgError("42501", ""))).toBe("reject"); // empty message, real code
  });

  it("copes with junk without throwing", () => {
    expect(classifyWriteError(null)).toBe("network");
    expect(classifyWriteError(undefined)).toBe("network");
    expect(classifyWriteError("a bare string")).toBe("network");
    expect(classifyWriteError({})).toBe("network");
    expect(classifyWriteError({ code: 23505 })).toBe("duplicate"); // numeric code coerced
  });
});

const item = (over: Partial<OutboxItem> = {}): OutboxItem => ({
  id: "11111111-1111-1111-1111-111111111111",
  table: "expenses",
  row: { id: "11111111-1111-1111-1111-111111111111", amount: 250, business_id: "b1", user_id: "u1" },
  createdAt: 1,
  attempts: 0,
  ...over,
});

describe("resolveOutboxItem", () => {
  it("synced when the write goes through", async () => {
    expect(await resolveOutboxItem(item(), async () => {})).toBe("synced");
  });

  it("synced when the row was already there — the replay was harmless", async () => {
    // The signal blipped after the first attempt actually landed. The retry
    // collides on the client id; that must count as done, not fail.
    const send = vi.fn(async () => {
      throw pgError("23505");
    });
    expect(await resolveOutboxItem(item(), send)).toBe("synced");
  });

  it("keeps a still-offline item for the next flush", async () => {
    const send = async () => {
      throw networkError();
    };
    expect(await resolveOutboxItem(item(), send)).toBe("keep");
  });

  it("fails an item the server refuses, rather than looping on it forever", async () => {
    const send = async () => {
      throw pgError("42501"); // RLS said no — retrying gets the same no
    };
    expect(await resolveOutboxItem(item(), send)).toBe("failed");
  });

  it("passes the exact item to send, so nothing is re-resolved at flush time", async () => {
    const send = vi.fn(async () => {});
    const it0 = item();
    await resolveOutboxItem(it0, send);
    expect(send).toHaveBeenCalledWith(it0);
    // The row already carries business_id/user_id — the flush needs no DB lookup.
    expect(it0.row).toHaveProperty("business_id", "b1");
    expect(it0.row).toHaveProperty("user_id", "u1");
  });
});

describe("the safety property, end to end", () => {
  it("a flaky write that actually landed is never entered twice", async () => {
    // The first attempt reached the server and inserted the row, but the
    // response was lost to a dropped connection — so the client saw a network
    // error and queued it. A send that inserts-if-absent models the real table:
    // on flush it sees the id is already there and raises 23505.
    const table = new Set<string>(["11111111-1111-1111-1111-111111111111"]); // the lost-response row
    const send = async (i: OutboxItem) => {
      if (table.has(i.id)) throw pgError("23505");
      table.add(i.id);
    };
    expect(await resolveOutboxItem(item(), send)).toBe("synced");
    expect(table.size).toBe(1); // still one row — the money was not entered a second time
  });
});

describe("newClientId", () => {
  it("mints a distinct uuid each call", () => {
    const a = newClientId();
    const b = newClientId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});
