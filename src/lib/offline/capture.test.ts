import { describe, expect, it, vi, beforeEach } from "vitest";

// The outbox is IndexedDB and identity is a live session — both browser-only.
// Mock them so this test can drive captureWrite's four branches purely on what
// the insert does, which is the part that decides whether money is queued,
// dropped, or surfaced as an error.
const { enqueueOutbox } = vi.hoisted(() => ({ enqueueOutbox: vi.fn(async () => {}) }));
vi.mock("./outbox", () => ({ enqueueOutbox }));
vi.mock("./identity", () => ({
  resolveIdentity: vi.fn(async () => ({ businessId: "b1", userId: "u1" })),
}));

import { captureWrite } from "./capture";

// A minimal stand-in for the supabase client: from(table).insert(row) runs
// whatever the test supplies. Only that one path is exercised.
type InsertImpl = (row: Record<string, unknown>) => unknown;
function fakeClient(insert: InsertImpl) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: () => ({ insert }) } as any;
}

const pgError = (code: string) => ({ code, message: "", details: null, hint: null });

beforeEach(() => {
  enqueueOutbox.mockClear();
});

describe("captureWrite", () => {
  it("stamps the row with a client id and the resolved identity", async () => {
    let seen: Record<string, unknown> | null = null;
    const client = fakeClient((row) => {
      seen = row;
      return { error: null };
    });
    const { row, queued } = await captureWrite(client, "income", { amount: 250 });
    expect(queued).toBe(false);
    expect(seen).toStrictEqual(row); // exactly what was inserted is returned
    expect(row).toMatchObject({ amount: 250, business_id: "b1", user_id: "u1" });
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/); // a real client uuid, minted here
    expect(enqueueOutbox).not.toHaveBeenCalled();
  });

  it("queues the entry when the insert returns a codeless (network) error", async () => {
    const client = fakeClient(() => ({ error: { message: "Failed to fetch" } })); // no SQLSTATE
    const { row, queued } = await captureWrite(client, "expenses", { amount: 40 });
    expect(queued).toBe(true);
    expect(enqueueOutbox).toHaveBeenCalledTimes(1);
    expect(enqueueOutbox).toHaveBeenCalledWith(
      expect.objectContaining({ id: row.id, table: "expenses", row, attempts: 0 })
    );
  });

  it("queues the entry when the insert THROWS instead of returning an error", async () => {
    // Some fetch stacks reject rather than resolving with { error }. The entry
    // must still be caught and queued, never allowed to escape unsaved.
    const client = fakeClient(() => {
      throw new TypeError("Failed to fetch");
    });
    const { queued } = await captureWrite(client, "income", { amount: 99 });
    expect(queued).toBe(true);
    expect(enqueueOutbox).toHaveBeenCalledTimes(1);
  });

  it("treats a duplicate (a prior attempt already landed) as done, not queued", async () => {
    const client = fakeClient(() => ({ error: pgError("23505") }));
    const { queued } = await captureWrite(client, "income", { amount: 10 });
    expect(queued).toBe(false);
    expect(enqueueOutbox).not.toHaveBeenCalled();
  });

  it("throws a server rejection rather than queueing a doomed retry", async () => {
    const client = fakeClient(() => ({ error: pgError("42501") })); // RLS said no
    await expect(captureWrite(client, "expenses", { amount: 10 })).rejects.toMatchObject({ code: "42501" });
    expect(enqueueOutbox).not.toHaveBeenCalled();
  });
});
