"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { TOOL_LABELS, type ToolId } from "@/lib/permissions";

// Only tools that have a real route today can be deep-linked. Anything the
// assistant names that isn't here just renders without a jump link.
const TOOL_HREF: Partial<Record<ToolId, string>> = {
  stock: "/stock",
  recipe: "/recipes",
  clients: "/contacts",
  suppliers: "/contacts",
  quote: "/quotes",
  invoice: "/invoices",
  statement: "/statement",
  purchaseorder: "/purchase-orders",
  supplierinvoice: "/supplier-invoices",
  remittance: "/remittance",
  booking: "/bookings",
  timetrack: "/time",
  mileage: "/mileage",
  staffregister: "/staff",
  payrun: "/payroll",
  advances: "/advances",
  leave: "/leave",
  bankstatement: "/bank-statement",
  cashup: "/cash-up",
  ledger: "/ledger",
  profit: "/cashflow",
  profitloss: "/profit-loss",
  tax: "/tax",
  taxjar: "/taxjar",
  vat201: "/vat201",
  emp201: "/emp201",
  provtax: "/provtax",
  compliance: "/compliance",
  ageanalysis: "/age-analysis",
};

const TOPICS = [
  { label: "Where do I start?", icon: "🚀" },
  { label: "How do I send a quote?", icon: "📋" },
  { label: "How do I pay my staff?", icon: "💼" },
  { label: "How does VAT work in WORKLOG?", icon: "🏦" },
  { label: "How do I track mileage for SARS?", icon: "🚗" },
  { label: "What is UIF and how is it calculated?", icon: "📊" },
];

type ChatMessage = { role: "user" | "assistant"; content: string; tool?: ToolId | null; followups?: string[] };

export function HelpAssistantModal({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
      setMessages([...history, { role: "assistant", content: data.answer, tool: data.tool, followups: data.followups }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't answer that.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Help" onClose={onClose}>
      {messages.length === 0 && (
        <>
          <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "12px 14px", marginBottom: 14, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700 }}>💬 Ask me anything</span> — how to use WORKLOG, or how SA tax and labour
            rules apply to your business.
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
            Popular questions
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {TOPICS.map((t) => (
              <button
                key={t.label}
                onClick={() => ask(t.label)}
                style={{ textAlign: "left", padding: "11px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 10 }}
              >
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}

      {messages.length > 0 && (
        <div style={{ maxHeight: 380, overflowY: "auto", marginBottom: 12 }}>
          {messages.map((m, i) => {
            if (m.role === "user") {
              return (
                <div key={i} style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                  <div style={{ background: "#0C4A6E", color: "#fff", borderRadius: "14px 14px 4px 14px", padding: "10px 14px", fontSize: 13, maxWidth: "85%" }}>
                    {m.content}
                  </div>
                </div>
              );
            }
            const href = m.tool ? TOOL_HREF[m.tool] : undefined;
            const label = m.tool ? TOOL_LABELS[m.tool] : undefined;
            return (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px 14px 14px 4px", padding: "12px 14px", fontSize: 13, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {m.content}
                </div>
                {href && label && (
                  <Link
                    href={href}
                    onClick={onClose}
                    style={{ display: "inline-block", marginTop: 8, background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 700, color: "#0C4A6E", textDecoration: "none" }}
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
            );
          })}
          {loading && <div style={{ fontSize: 12, color: "#94a3b8", padding: "8px 4px" }}>Thinking…</div>}
          <div ref={bottomRef} />
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 10 }}>{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          style={{ flex: 1, padding: "13px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, background: "#f8fafc", color: "#111", outline: "none", boxSizing: "border-box" }}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          style={{ background: !input.trim() || loading ? "#94a3b8" : "#0C4A6E", border: "none", borderRadius: 12, padding: "0 18px", fontSize: 16, fontWeight: 700, color: "#fff", cursor: !input.trim() || loading ? "default" : "pointer" }}
        >
          ↑
        </button>
      </form>
    </Modal>
  );
}
