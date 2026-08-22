"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loggy } from "@/components/ui/Loggy";
import { TOOL_LABELS, type ToolId } from "@/lib/permissions";

// Loggy — Worklog's help bot. A floating launcher on every app screen opens a
// chat grounded in the Help Centre (see /api/help-assistant, which now reads the
// same guides users browse at /help). This replaces the old dashboard-only Help
// modal: one helper, reachable everywhere, wearing the mascot's face.

// Only tools that have a real route today can be deep-linked. Anything the
// assistant names that isn't here just renders without a jump link.
const TOOL_HREF: Partial<Record<ToolId, string>> = {
  stock: "/stock",
  recipe: "/recipes",
  clients: "/customers",
  suppliers: "/suppliers",
  quote: "/quotes",
  invoice: "/invoices",
  statement: "/statement",
  purchaseorder: "/purchase-orders",
  supplierinvoice: "/supplier-invoices",
  remittance: "/remittance",
  booking: "/diary",
  timetrack: "/time",
  mileage: "/mileage",
  staffregister: "/staff",
  payrun: "/payroll",
  advances: "/advances",
  leave: "/leave",
  bankstatement: "/bank-statement",
  cashup: "/cash-up",
  profit: "/cashflow",
  profitloss: "/profit-loss",
  tax: "/tax",
  taxjar: "/taxjar",
  vat201: "/vat201",
  emp201: "/payroll-compliance?tab=emp201",
  provtax: "/provtax",
  compliance: "/compliance",
  ageanalysis: "/age-analysis",
  payables: "/age-analysis-payables",
};

const TOPICS = [
  { label: "Where do I start?", icon: "🚀" },
  { label: "How do I send a quote?", icon: "📋" },
  { label: "How do I pay my staff?", icon: "💼" },
  { label: "How does VAT work in Worklog?", icon: "🏦" },
  { label: "How do I log travel for SARS?", icon: "🚗" },
  { label: "What is UIF and how is it worked out?", icon: "📊" },
];

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  tool?: ToolId | null;
  guideSlug?: string | null;
  followups?: string[];
};

type LoggyContextValue = { isOpen: boolean; open: () => void; close: () => void; toggle: () => void };
const LoggyContext = createContext<LoggyContextValue | null>(null);

/** Open Loggy from anywhere in the app (e.g. a header "Help" button). */
export function useLoggy(): LoggyContextValue {
  const ctx = useContext(LoggyContext);
  if (!ctx) throw new Error("useLoggy must be used within <LoggyProvider>");
  return ctx;
}

export function LoggyProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  return (
    <LoggyContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
      <LoggyUI />
    </LoggyContext.Provider>
  );
}

function LoggyUI() {
  const { isOpen, open, close } = useLoggy();
  const pathname = usePathname();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // When the panel closes, hand focus back to the launcher (not to <body>), so
  // keyboard and screen-reader users keep their place.
  useEffect(() => {
    if (wasOpen.current && !isOpen) launcherRef.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen]);

  // No help bot where there's no app around it: onboarding and the checkout
  // flow, matching the sidebar and mobile tab bar.
  if (pathname === "/onboarding" || pathname.startsWith("/billing")) return null;

  return (
    <>
      {/* The launcher stays mounted while the panel is open (just hidden), so
          focus can return to it on close. */}
      <button
        ref={launcherRef}
        type="button"
        className="loggy-launcher"
        onClick={open}
        aria-label="Ask Loggy for help"
        aria-expanded={isOpen}
        style={isOpen ? { display: "none" } : undefined}
      >
        <Loggy pose="happy" size={44} />
        <span className="loggy-launcher-label" aria-hidden="true">
          ?
        </span>
      </button>
      {isOpen && <LoggyPanel onClose={close} />}
    </>
  );
}

function LoggyPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewportH, setViewportH] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // On open, move focus into the dialog. On a mouse/desktop, focus the input to
  // type straight away; on touch we focus the panel instead, so we don't pop the
  // on-screen keyboard over the welcome message and the popular questions.
  useEffect(() => {
    const fine = typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches;
    if (fine) inputRef.current?.focus();
    else panelRef.current?.focus();
  }, []);

  // Follow the visual viewport so the full-screen mobile sheet shrinks with the
  // on-screen keyboard instead of hiding the input behind it (globals.css reads
  // the --loggy-vh we set here).
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const onResize = () => setViewportH(vv.height);
    onResize();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  // Escape-to-close and a Tab trap, at document level — a handler on the panel
  // div alone misses keydowns once focus leaves it (e.g. the send button
  // disables itself after a click and drops focus to <body>).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (!active || !panelRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setError("");
    setInput("");
    const history: ChatMessage[] = [...messages, { role: "user", content: q }];
    setMessages(history);
    setLoading(true);
    try {
      const res = await fetch("/api/help-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Couldn't answer that.");
      setMessages([
        ...history,
        { role: "assistant", content: data.answer, tool: data.tool, guideSlug: data.guideSlug, followups: data.followups },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't answer that.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="loggy-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Loggy — Worklog help"
      ref={panelRef}
      tabIndex={-1}
      style={viewportH ? ({ ["--loggy-vh"]: `${viewportH}px`, outline: "none" } as React.CSSProperties) : { outline: "none" }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#0C4A6E", color: "#fff", flexShrink: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Loggy pose="happy" size={30} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.1 }}>Loggy</div>
          <div style={{ fontSize: 11.5, color: "#BAE6FD" }}>Your Worklog helper</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ background: "rgba(255,255,255,0.14)", border: "none", color: "#fff", fontSize: 20, lineHeight: 1, width: 32, height: 32, borderRadius: 8, cursor: "pointer", flexShrink: 0 }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px", background: "#f8fafc" }}>
        {messages.length === 0 && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <Loggy pose="wow" size={44} animate="bob" style={{ flexShrink: 0 }} />
              <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: "4px 14px 14px 14px", padding: "11px 13px", fontSize: 12.5, color: "#0369A1", lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700 }}>Hi, I&apos;m Loggy 👋</span> Ask me anything about using Worklog, or how SA tax and labour rules apply to your business.
              </div>
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
              Popular questions
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {TOPICS.map((t) => (
                <button
                  key={t.label}
                  onClick={() => ask(t.label)}
                  style={{ textAlign: "left", padding: "10px 13px", border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 9 }}
                >
                  <span style={{ fontSize: 15 }}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
            <Link
              href="/help"
              onClick={onClose}
              style={{ display: "block", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#0C4A6E", textDecoration: "none", padding: "2px 0" }}
            >
              Or browse the full Help Centre →
            </Link>
          </>
        )}

        {messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <div key={i} style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <div style={{ background: "#0C4A6E", color: "#fff", borderRadius: "14px 14px 4px 14px", padding: "9px 13px", fontSize: 13, maxWidth: "85%" }}>
                  {m.content}
                </div>
              </div>
            );
          }
          const href = m.tool ? TOOL_HREF[m.tool] : undefined;
          const label = m.tool ? TOOL_LABELS[m.tool] : undefined;
          return (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <Loggy pose="happy" size={30} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "4px 14px 14px 14px", padding: "11px 13px", fontSize: 13, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {m.content}
                </div>
                {/* Read-the-guide link: the answer is grounded in this Help Centre guide */}
                {m.guideSlug && (
                  <Link
                    href={`/help/${m.guideSlug}`}
                    onClick={onClose}
                    style={{ display: "inline-block", marginTop: 8, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "7px 13px", fontSize: 12, fontWeight: 700, color: "#0C4A6E", textDecoration: "none" }}
                  >
                    📖 Read the full guide →
                  </Link>
                )}
                {href && label && (
                  <Link
                    href={href}
                    onClick={onClose}
                    style={{ display: "inline-block", marginTop: 8, marginLeft: m.guideSlug ? 6 : 0, background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 10, padding: "7px 13px", fontSize: 12, fontWeight: 700, color: "#0C4A6E", textDecoration: "none" }}
                  >
                    {label.icon} Open {label.label} →
                  </Link>
                )}
                {(m.followups ?? []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {(m.followups ?? []).slice(0, 2).map((f) => (
                      <button
                        key={f}
                        onClick={() => ask(f)}
                        style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 20, padding: "6px 12px", fontSize: 11, fontWeight: 600, color: "#64748b", cursor: "pointer" }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "2px 4px" }}>
            <Loggy pose="happy" size={26} animate="bob" />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Loggy is thinking…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer / input */}
      <div style={{ flexShrink: 0, borderTop: "1px solid #e2e8f0", padding: "10px 12px calc(10px + env(safe-area-inset-bottom, 0px))", background: "#fff" }}>
        {error && <p style={{ color: "#dc2626", fontSize: 12, margin: "0 0 8px" }}>{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          style={{ display: "flex", gap: 8 }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Loggy a question…"
            style={{ flex: 1, padding: "12px 13px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, background: "#f8fafc", color: "#111", outline: "none", boxSizing: "border-box", minWidth: 0 }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Send"
            style={{ background: !input.trim() || loading ? "#94a3b8" : "#0C4A6E", border: "none", borderRadius: 12, padding: "0 16px", fontSize: 16, fontWeight: 700, color: "#fff", cursor: !input.trim() || loading ? "default" : "pointer", flexShrink: 0 }}
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}
