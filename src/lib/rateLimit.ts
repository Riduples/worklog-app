import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The routes that cost money to serve. The name is the key the SQL side keys
 * its limits off — consume_rate_limit() in migration 0058 — so these strings
 * have to match the CASE arms there, and an unknown one raises rather than
 * quietly waving the request through.
 */
export type RateLimitedRoute = "quick-log" | "help-assistant" | "parse-statement" | "render-pdf";

type Verdict = {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset_at: string;
  retry_after: number;
};

const FRIENDLY: Record<RateLimitedRoute, string> = {
  "quick-log": "You've done a lot of Quick Logs in the last hour.",
  "help-assistant": "You've asked the assistant a lot of questions in the last hour.",
  "parse-statement": "You've uploaded a lot of bank statements in the last hour.",
  "render-pdf": "You've made a lot of PDFs in the last hour.",
};

/**
 * Counts this request against the caller's hourly quota.
 *
 * Returns a 429 to send back, or null to carry on. Call it after the auth check
 * and before doing any of the expensive work — the whole point is to not spend
 * the money.
 *
 * The limits live in Postgres rather than here, and deliberately: these routes
 * talk to the database as the signed-in user (there is no service-role key), so
 * a limit passed from this side would be a limit the user could pick. This only
 * says which route is asking.
 *
 * Fails OPEN. If the limiter itself errors — the RPC is unreachable, the
 * migration hasn't run on this environment — the request proceeds. The cost of
 * being wrong in that direction is a bill; the cost of being wrong the other way
 * is that a broken limiter takes Quick Log down for everyone. A ceiling is not
 * worth an outage, and the error is logged so it doesn't stay invisible.
 */
export async function enforceRateLimit(
  supabase: SupabaseClient,
  route: RateLimitedRoute
): Promise<NextResponse | null> {
  const { data, error } = await supabase.rpc("consume_rate_limit", { p_route: route });

  if (error) {
    console.error(`[rate-limit] ${route}: limiter unavailable, allowing request —`, error.message);
    return null;
  }

  const verdict = data as Verdict | null;
  if (!verdict || verdict.allowed) return null;

  const minutes = Math.max(1, Math.ceil(verdict.retry_after / 60));
  return NextResponse.json(
    {
      error: "rate_limited",
      message: `${FRIENDLY[route]} Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      retry_after: verdict.retry_after,
    },
    {
      status: 429,
      headers: {
        // Standard enough that a client library or proxy will do the right
        // thing without being taught about our JSON shape.
        "Retry-After": String(verdict.retry_after),
        "RateLimit-Limit": String(verdict.limit),
        "RateLimit-Remaining": String(verdict.remaining),
        "RateLimit-Reset": String(verdict.retry_after),
      },
    }
  );
}
