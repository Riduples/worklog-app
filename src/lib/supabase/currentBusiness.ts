import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// Every user belongs to exactly one business today (invite-accept isn't built
// yet, so business_members has one row per user). Once multi-business
// membership is possible this needs a "current business" selector instead of
// picking the first membership row.
export async function getCurrentBusinessId(supabase: SupabaseClient<Database>): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (error || !data) throw new Error("No business found for this user");
  return data.business_id;
}
