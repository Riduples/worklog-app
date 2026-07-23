"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database";

const STYLES = {
  info: { bg: "#F0F9FF", border: "#7DD3FC", color: "#0C4A6E", icon: "📣" },
  warning: { bg: "#FFF7ED", border: "#FB923C", color: "#9A3412", icon: "⚠️" },
  success: { bg: "#F0FDF4", border: "#86EFAC", color: "#166534", icon: "🎉" },
};
const DISMISS_KEY = "worklog-dismissed-announcement";

// The link is admin-set but shown to every user, so only ever follow a relative
// path or an http(s) URL — never a javascript:/data: scheme.
const safeHref = (url: string | null): string | null => {
  if (!url) return null;
  // A single leading slash only — "//evil.com" / "/\evil.com" are protocol-relative
  // and would navigate off-site.
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")) return url;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
};

/**
 * The platform-wide announcement banner, shown on every app page. RLS only ever
 * returns announcements that are live now, and we additionally window-filter on
 * the client; a dismissible one is remembered in localStorage by id, so a NEW
 * announcement (different id) shows again.
 */
export function AnnouncementBanner() {
  const supabase = createClient();
  const pathname = usePathname();
  const { data } = useQuery({
    queryKey: ["active-announcement"],
    queryFn: async (): Promise<Tables<"announcements"> | null> => {
      const { data, error } = await supabase.from("announcements").select("*").eq("active", true).order("created_at", { ascending: false });
      if (error) throw error;
      const now = Date.now();
      const live = (data ?? []).find(
        (a) => (!a.starts_at || new Date(a.starts_at).getTime() <= now) && (!a.ends_at || new Date(a.ends_at).getTime() >= now)
      );
      return live ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Read the dismissals client-side only (avoids an SSR/hydration mismatch). An
  // array, not a single id, so every dismissed announcement stays dismissed —
  // dismissing a newer one doesn't resurrect an older re-activated one.
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(DISMISS_KEY) : null;
      setDismissed(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setDismissed([]);
    }
  }, [data]);

  // Not on first-run onboarding or mid-payment — a banner there competes with the
  // task or undermines checkout confidence.
  const hidden = pathname === "/onboarding" || pathname.startsWith("/billing");
  if (hidden || !data) return null;

  // Keyed on id + updated_at so a NEW announcement, or an EDIT to an existing one,
  // re-shows even to a user who dismissed the previous version.
  const dismissKey = `${data.id}:${data.updated_at}`;
  if (data.dismissible && dismissed.includes(dismissKey)) return null;

  const st = STYLES[data.level as keyof typeof STYLES] ?? STYLES.info;
  const href = safeHref(data.link_url);
  const dismiss = () => {
    const next = [...dismissed, dismissKey].slice(-50);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    setDismissed(next);
  };

  return (
    <div style={{ margin: "12px 16px 0", background: st.bg, border: `1.5px solid ${st.border}`, borderRadius: 12, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{st.icon}</span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: st.color, lineHeight: 1.5 }}>
        {data.message}
        {href && (
          <>
            {" "}
            <Link href={href} style={{ color: st.color, fontWeight: 800 }}>
              {data.link_label || "Learn more"} →
            </Link>
          </>
        )}
      </div>
      {data.dismissible && (
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{ flexShrink: 0, background: "transparent", border: "none", color: st.color, fontSize: 18, cursor: "pointer", opacity: 0.6, lineHeight: 1, padding: 0 }}
        >
          ×
        </button>
      )}
    </div>
  );
}
