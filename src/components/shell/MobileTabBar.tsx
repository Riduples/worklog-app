"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWriteAccess } from "@/lib/writeAccess";
import { useToolGate } from "@/lib/useToolGate";
import { QuickLogModal } from "@/components/modals/QuickLogModal";
import { AllToolsGrid } from "@/components/dashboard/AllToolsGrid";

// The phone's primary navigation — a sticky bottom bar, mobile-only (a desktop has
// the sidebar, so this is hidden by CSS at >=1024px). Home / Money / Log (centre) /
// Reports / More; "More" is the mobile stand-in for the sidebar's full tool list.
export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isReadOnly } = useWriteAccess();
  const { gate } = useToolGate();
  const [quickOpen, setQuickOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Any navigation dismisses the overlays — otherwise the More sheet would sit over
  // whatever page a tool link just opened.
  useEffect(() => {
    setMoreOpen(false);
    setQuickOpen(false);
  }, [pathname]);

  // No bottom bar where there's no app to navigate: onboarding and the checkout flow.
  if (pathname === "/onboarding" || pathname.startsWith("/billing")) return null;

  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const tab = (href: string, icon: string, label: string) => {
    const on = active(href);
    return (
      <Link key={href} href={href} className="mtab" style={{ color: on ? "#0C4A6E" : "#94a3b8", fontWeight: on ? 800 : 600 }}>
        <span className="mtab-ic">{icon}</span>
        {label}
      </Link>
    );
  };

  return (
    <>
      {/* Left / right groups with a fixed centre keep Log dead-centre however many
          side tabs a given member's permissions leave. Money (Cash Flow) and
          Reports (Profit & Loss) only appear if the member can actually open them —
          otherwise the tap would just bounce them to an upgrade prompt. Home, Log
          and More are always there; More's sheet is self-gating. */}
      <nav className="mobile-tabbar" aria-label="Main">
        <div className="mtab-group">
          {tab("/dashboard", "⌂", "Home")}
          {gate("profit") && tab("/cashflow", "💳", "Money")}
        </div>
        <button
          type="button"
          className="mtab mtab-log"
          onClick={() => (isReadOnly ? router.push("/billing/checkout") : setQuickOpen(true))}
          aria-label="Quick Log"
        >
          <span className="mtab-log-ic">✨</span>
          Log
        </button>
        <div className="mtab-group">
          {gate("profitloss") && tab("/profit-loss", "📈", "Reports")}
          <button
            type="button"
            className="mtab"
            onClick={() => setMoreOpen(true)}
            style={{ color: moreOpen ? "#0C4A6E" : "#94a3b8", fontWeight: moreOpen ? 800 : 600 }}
          >
            <span className="mtab-ic">⋯</span>
            More
          </button>
        </div>
      </nav>

      {quickOpen && <QuickLogModal onClose={() => setQuickOpen(false)} />}

      {moreOpen && (
        <div className="mobile-more-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="mobile-more-sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0C4A6E" }}>All tools</div>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                style={{ background: "none", border: "none", fontSize: 24, color: "#94a3b8", cursor: "pointer", lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <AllToolsGrid
              onLockedClick={(t) => {
                setMoreOpen(false);
                router.push(`/dashboard?upgrade=${t}`);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
