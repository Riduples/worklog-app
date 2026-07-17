import { describe, expect, it, vi } from "vitest";
import { enforceRateLimit } from "./rateLimit";
import type { SupabaseClient } from "@supabase/supabase-js";

// Only the one method enforceRateLimit touches. The limit decision itself lives
// in Postgres (migration 0058) and is verified against the live database; what's
// under test here is how this side reacts to each answer.
const stub = (rpc: unknown) => ({ rpc: vi.fn().mockResolvedValue(rpc) }) as unknown as SupabaseClient;

const verdict = (over: Record<string, unknown> = {}) => ({
  data: { allowed: true, limit: 40, remaining: 39, reset_at: "2026-07-17T10:00:00Z", retry_after: 900, ...over },
  error: null,
});

describe("enforceRateLimit", () => {
  it("waves through a request under the limit", async () => {
    expect(await enforceRateLimit(stub(verdict()), "quick-log")).toBeNull();
  });

  it("asks Postgres about the route it was given, and passes no limit of its own", async () => {
    // The limits must not be caller-supplied: these routes talk to the database
    // as the signed-in user, so anything sent from here is user-controlled.
    const supabase = stub(verdict());
    await enforceRateLimit(supabase, "parse-statement");
    expect(supabase.rpc).toHaveBeenCalledWith("consume_rate_limit", { p_route: "parse-statement" });
  });

  it("returns 429 once over the limit", async () => {
    const res = await enforceRateLimit(stub(verdict({ allowed: false, remaining: 0 })), "quick-log");
    expect(res?.status).toBe(429);
  });

  it("tells the client when to come back, in headers and in words", async () => {
    const res = await enforceRateLimit(stub(verdict({ allowed: false, remaining: 0, retry_after: 900 })), "quick-log");
    expect(res?.headers.get("Retry-After")).toBe("900");
    expect(res?.headers.get("RateLimit-Limit")).toBe("40");
    expect(await res?.json()).toMatchObject({ error: "rate_limited", retry_after: 900 });
  });

  it("rounds the wait up to whole minutes, and never says 0 minutes", async () => {
    const res = await enforceRateLimit(stub(verdict({ allowed: false, retry_after: 5 })), "quick-log");
    const body = await res?.json();
    expect(body.message).toContain("1 minute");
    expect(body.message).not.toContain("0 minute");
  });

  it("says minutes, not minute, when there is more than one", async () => {
    const res = await enforceRateLimit(stub(verdict({ allowed: false, retry_after: 900 })), "quick-log");
    expect((await res?.json()).message).toContain("15 minutes");
  });

  it("names the thing the user was actually doing", async () => {
    const res = await enforceRateLimit(stub(verdict({ allowed: false })), "parse-statement");
    expect((await res?.json()).message).toContain("bank statements");
  });

  it("fails open when the limiter itself is unavailable", async () => {
    // A broken limiter must not take Quick Log down for everyone. Being wrong
    // this way costs money; being wrong the other way costs the product.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await enforceRateLimit(stub({ data: null, error: { message: "relation does not exist" } }), "quick-log");
    expect(res).toBeNull();
    expect(err).toHaveBeenCalled(); // failing open silently would hide a broken limiter
    err.mockRestore();
  });

  it("fails open on an empty verdict rather than guessing", async () => {
    expect(await enforceRateLimit(stub({ data: null, error: null }), "quick-log")).toBeNull();
  });
});
