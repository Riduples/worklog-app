"use client";

import { ACCESS_LEVEL_MAP, type AccessLevel } from "@/lib/permissions";

// Shown in place of the add/edit controls when the member's access level for a
// tool is below what the action needs. Ported in spirit from worklog-v65's
// AccessBadge: tell the user why the button isn't there rather than silently
// hiding it, so "I can't find the button" doesn't become a support question.
export function ReadOnlyNotice({ level, what = "records" }: { level: AccessLevel; what?: string }) {
  const meta = ACCESS_LEVEL_MAP[level];
  return (
    <div
      style={{
        background: meta.bg,
        border: `1.5px solid ${meta.border}`,
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 14,
        fontSize: 12,
        color: meta.color,
        lineHeight: 1.5,
      }}
    >
      {`${meta.icon} ${meta.label} access — you can see ${what} here but not change them. Ask the business owner if you need more.`}
    </div>
  );
}
