"use client";

import { useCurrentMember } from "@/lib/supabase/hooks/useCurrentMember";
import { getAccess, canView, canEdit, canApprove, canDelete, type AccessLevel, type ToolId } from "@/lib/permissions";

export type ToolAccess = {
  level: AccessLevel;
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canDelete: boolean;
  /** The member row hasn't loaded yet — don't render a verdict on it. */
  loading: boolean;
};

// One place for a view to ask "what may this user do with this tool?".
//
// The real boundary is RLS (has_tool_access in migration 0047) — this only
// keeps the UI honest so nobody is offered a button whose write the database
// will reject. Never treat it as the security control.
//
// While the membership row is loading we assume no access: showing a button
// and then having the save fail is worse than showing it a beat late.
export function useToolAccess(toolId: ToolId): ToolAccess {
  const { data: member, isPending } = useCurrentMember();

  if (!member) {
    return { level: "off", canView: false, canEdit: false, canApprove: false, canDelete: false, loading: isPending };
  }

  return {
    level: getAccess(member, toolId),
    canView: canView(member, toolId),
    canEdit: canEdit(member, toolId),
    canApprove: canApprove(member, toolId),
    canDelete: canDelete(member, toolId),
    loading: false,
  };
}
