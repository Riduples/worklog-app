"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { subscribeReadOnlyToast } from "@/lib/readOnlyToast";
import { useLoggy } from "@/components/shell/LoggyAssistant";

/**
 * Shown for a few seconds when a write is blocked because the business is
 * read-only — the catch-all friendly nudge for the inline delete/status actions
 * that don't go through a gated SaveBtn. Proactively-gated buttons (SaveBtn, Quick
 * Log) never fire their mutation, so this only surfaces for the long tail.
 */
export function ReadOnlyToast() {
  const [show, setShow] = useState(false);
  const { isOpen: loggyOpen } = useLoggy();
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => subscribeReadOnlyToast(() => {
    setShow(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShow(false), 5000);
  }), []);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  // While the Loggy chat sheet is open, don't float this over its input.
  if (!show || loggyOpen) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        zIndex: 1000,
        maxWidth: "calc(100vw - 32px)",
        background: "#0C4A6E",
        color: "#fff",
        borderRadius: 12,
        padding: "12px 16px",
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.5,
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span>🔒 Your trial has ended — your records are safe.</span>
      <Link href="/billing/checkout" style={{ color: "#E8A33D", fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>
        Choose a plan →
      </Link>
    </div>
  );
}
