import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isLocked, type Plan } from "@/lib/tiers";
import type { ToolId } from "@/lib/permissions";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Guards a platform-admin page (e.g. the SARS rates editor). These edit NATIONAL
 * data shared by every tenant, so access is the platform_admins list (migration
 * 0054), not business ownership. A non-admin is bounced to their own dashboard.
 */
export async function requirePlatformAdmin() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) redirect("/dashboard");
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

/**
 * Guards a page that a plan can lock.
 *
 * isLocked() only ever decided whether a dashboard tile drew a padlock —
 * nothing checked the plan on the way into the page, so a Shoebox user could
 * simply type /staff and use the Staff Register in full.
 *
 * RLS is what actually stops the write (plan_allows, migration 0052). This is
 * so they meet the upgrade prompt instead of a database rejection, which is a
 * courtesy rather than the control: never the only thing between a plan and a
 * feature.
 */
export async function requirePlanAccess(tool: ToolId | "team") {
  const { user, profile } = await requireBusinessProfile();
  const plan = (profile.plan ?? "solo") as Plan;
  if (isLocked(plan, tool)) redirect(`/dashboard?upgrade=${encodeURIComponent(tool)}`);
  return { user, profile };
}
