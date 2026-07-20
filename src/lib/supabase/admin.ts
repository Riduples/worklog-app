import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// The service-role client — it bypasses Row Level Security.
//
// Used only by the PayFast ITN handler, which has to write `subscriptions` and
// `payment_events`: two tables that, by design, no signed-in user may write. A
// client that could write its own subscription could grant itself a paid plan,
// so the write path runs on the server, off the back of a signature PayFast
// verified, not off a session.
//
// Server-only. SUPABASE_SERVICE_ROLE_KEY is a full-access secret; it must live
// in the host environment and never be prefixed NEXT_PUBLIC_ or reach a browser
// bundle. Importing this file from a client component would be a serious leak.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role is not configured (SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient<Database>(url, key, {
    // A machine, not a user: no session to persist or token to refresh.
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
