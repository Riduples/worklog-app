import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireBusinessProfile() {
  const user = await requireUser();
  const supabase = await createClient();
  // No explicit filter — RLS (business membership) scopes this to the
  // caller's own business, so this also works for invited members whose own
  // user_id doesn't match business_profiles.user_id (the owner's).
  const { data: profile } = await supabase.from("business_profiles").select("*").maybeSingle();
  if (!profile) redirect("/onboarding");
  return { user, profile };
}
