"use client";

import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useCurrentMember } from "@/lib/supabase/hooks/useCurrentMember";
import { canSee, type ToolId } from "@/lib/permissions";
import { coreToolsFor, isCoreTool } from "@/lib/businessTypes";
import { isLocked, type Plan } from "@/lib/tiers";

/**
 * Who may see which tool, and which of those their plan has paid for.
 *
 * Lives here because the dashboard and the sidebar both have to answer it and
 * must never disagree — a sidebar offering a tool the dashboard hides would be
 * the same tool with two opinions about whether you're allowed it. This was the
 * dashboard's private logic until the sidebar needed it too.
 *
 * Neither answer is a security boundary. RLS decides what the database will
 * actually hand over (0047), and requirePlanAccess() bounces a page a plan
 * doesn't include (0052). This only decides what is worth showing.
 */
export function useToolGate() {
  const { data: business } = useBusinessProfile();
  const { data: currentMember } = useCurrentMember();

  // Default to full access while the membership row loads, so the
  // overwhelmingly common single-owner case never flashes hidden tools.
  const member = currentMember ?? { role: "owner", permissions: {} };
  const plan = (business?.plan ?? "solo") as Plan;

  // Two independent filters, in the prototype's order: permission decides what
  // you're ALLOWED to see, business type decides what's WORTH showing you.
  // Type filtering hides rather than locks — a tool it removes stays reachable
  // by URL and by turning on "Show every tool".
  const coreTools = coreToolsFor(business);

  return {
    business,
    plan,
    isOwner: member.role === "owner",
    gate: (toolId: ToolId) => canSee(member, toolId) && isCoreTool(coreTools, toolId),
    tierLocked: (toolId: ToolId) => isLocked(plan, toolId),
  };
}
