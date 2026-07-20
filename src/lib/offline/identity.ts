"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";

/**
 * Who and which business a queued write belongs to, resolvable while offline.
 *
 * This exists because getCurrentBusinessId reads business_members from the
 * database, and there is no database offline — so a write captured in a dead
 * spot can't ask "which business is this?" the usual way. The answer is
 * remembered the last time the app was online (which, for a signal blip, was
 * seconds ago) and read back from localStorage when the network is gone.
 *
 * The row is stamped with both ids at capture, so the flush later replays a
 * complete row and never has to resolve identity again.
 */

const KEY = "worklog:identity";

type Identity = { businessId: string; userId: string };

function remember(identity: Identity): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    // localStorage can be disabled; offline capture just won't be available.
  }
}

function recall(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    return parsed.businessId && parsed.userId ? { businessId: parsed.businessId, userId: parsed.userId } : null;
  } catch {
    return null;
  }
}

/**
 * The business and user id to stamp on a captured row.
 *
 * Online: resolves them for real and refreshes the remembered copy. Offline:
 * the user id comes from the cached session (getSession reads localStorage, no
 * network), and the business id from what was last remembered. If neither the
 * network nor a remembered identity is available — a first-ever use with no
 * connection — it throws, and the caller surfaces the write error rather than
 * queueing a row it can't attribute.
 */
export async function resolveIdentity(supabase: SupabaseClient<Database>): Promise<Identity> {
  // getSession is cache-only (no network), so it works offline.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionUserId = session?.user?.id ?? null;

  try {
    const businessId = await getCurrentBusinessId(supabase);
    const userId = sessionUserId ?? "";
    if (userId) remember({ businessId, userId });
    if (!userId) throw new Error("No user in session");
    return { businessId, userId };
  } catch (error) {
    const cached = recall();
    if (cached && (!sessionUserId || sessionUserId === cached.userId)) {
      return cached;
    }
    throw error instanceof Error ? error : new Error("Could not resolve identity");
  }
}

/**
 * Seed the remembered identity while we're (almost certainly) online, so a
 * later signal blip can attribute a captured row even if nothing has been
 * captured yet this session.
 *
 * Without this, identity is only cached as a side effect of the first
 * successful capture — which means someone who logs in and immediately loses
 * signal would have their very first entry error instead of queue. Called once
 * on app load; a no-op when identity is already cached, and a harmless no-op
 * when offline with nothing to cache yet.
 */
export async function primeIdentity(supabase: SupabaseClient<Database>): Promise<void> {
  if (recall()) return; // already seeded on this device
  try {
    await resolveIdentity(supabase); // resolves and remembers when reachable
  } catch {
    // Offline with nothing cached — nothing to prime until we're next online.
  }
}
