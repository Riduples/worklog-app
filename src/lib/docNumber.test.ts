import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getNextDocNumber, getNextDocNumbers } from "@/lib/docNumber";

// A stand-in for reserve_doc_numbers: holds one counter, adds the requested block
// to it and returns the last number reserved — the same contract the SQL has.
function fakeSupabase(startingAt = 0) {
  const calls: { prefix: string; year: number; count: number }[] = [];
  let counter = startingAt;
  const client = {
    rpc: async (_fn: string, args: { p_prefix: string; p_year: number; p_count: number }) => {
      calls.push({ prefix: args.p_prefix, year: args.p_year, count: args.p_count });
      counter += args.p_count;
      return { data: counter, error: null };
    },
  } as unknown as SupabaseClient;
  return { client, calls, current: () => counter };
}

const year = new Date().getFullYear();

describe("getNextDocNumbers", () => {
  it("formats a single number as PREFIX-YYYY-NNNN", async () => {
    const { client } = fakeSupabase();
    expect(await getNextDocNumber(client, "b1", "INV")).toBe(`INV-${year}-0001`);
  });

  it("counts a reserved block back from the last number, in order", async () => {
    // The function returns the END of the block, so the arithmetic has to walk
    // backwards. Off by one here and a batch either reuses the previous batch's
    // last number or skips one — the first duplicates a document number.
    const { client } = fakeSupabase();
    expect(await getNextDocNumbers(client, "b1", "INV", 3)).toEqual([
      `INV-${year}-0001`,
      `INV-${year}-0002`,
      `INV-${year}-0003`,
    ]);
  });

  it("continues from what the counter already holds, never restarting", async () => {
    const { client } = fakeSupabase(41);
    expect(await getNextDocNumbers(client, "b1", "QTE", 2)).toEqual([
      `QTE-${year}-0042`,
      `QTE-${year}-0043`,
    ]);
  });

  it("hands consecutive callers non-overlapping blocks", async () => {
    const { client } = fakeSupabase();
    const first = await getNextDocNumbers(client, "b1", "CN", 2);
    const second = await getNextDocNumbers(client, "b1", "CN", 2);
    expect(first).toEqual([`CN-${year}-0001`, `CN-${year}-0002`]);
    expect(second).toEqual([`CN-${year}-0003`, `CN-${year}-0004`]);
    expect(new Set([...first, ...second]).size).toBe(4);
  });

  it("reserves the whole batch in one call, not one call per row", async () => {
    // The CSV import numbers everyone in a single statement; a round trip per row
    // is what the block reservation exists to avoid.
    const { client, calls } = fakeSupabase();
    await getNextDocNumbers(client, "b1", "EMP", 50);
    expect(calls).toEqual([{ prefix: "EMP", year, count: 50 }]);
  });

  it("pads past four digits rather than truncating", async () => {
    const { client } = fakeSupabase(12344);
    expect(await getNextDocNumber(client, "b1", "SI")).toBe(`SI-${year}-12345`);
  });

  it("throws when the reservation fails rather than inventing a number", async () => {
    const failing = {
      rpc: async () => ({ data: null, error: { message: "denied" } }),
    } as unknown as SupabaseClient;
    await expect(getNextDocNumber(failing, "b1", "INV")).rejects.toBeTruthy();
  });

  it("throws when the counter returns less than it was asked to reserve", async () => {
    // Would otherwise produce a zero or negative first number and a document
    // called INV-2026-0000.
    const short = {
      rpc: async () => ({ data: 1, error: null }),
    } as unknown as SupabaseClient;
    await expect(getNextDocNumbers(short, "b1", "INV", 5)).rejects.toThrow(/reserve/i);
  });
});
