"use client";

import { useState } from "react";
import { useQuotes, type Quote } from "@/lib/supabase/hooks/useQuotes";
import { QuoteModal } from "@/components/modals/QuoteModal";
import { QuoteActionsModal } from "@/components/modals/QuoteActionsModal";
import { fmt } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { BackLink } from "@/components/ui/BackLink";

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "#fff7ed", fg: "#b45309" },
  accepted: { bg: "#F0F9FF", fg: "#0369A1" },
  converted: { bg: "#e0f2fe", fg: "#0369a1" },
  declined: { bg: "#fee2e2", fg: "#991b1b" },
};

// Filter pills follow this order; only statuses actually in use get a pill.
const STATUS_ORDER = ["pending", "accepted", "declined", "converted"];

const quoteNo = (q: Quote) => parseInt((q.doc_number ?? "").replace(/\D/g, ""), 10) || 0;

export function QuotesView() {
  const access = useToolAccess("quote");
  const { data: quotes, isLoading } = useQuotes();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sort, setSort] = useState<"az" | "number" | "recent">("recent");

  const presentStatuses = STATUS_ORDER.filter((s) => (quotes ?? []).some((q) => q.status === s));

  const filtered = (quotes ?? [])
    .filter((q) => {
      if (statusFilter !== "all" && q.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!q.client_name.toLowerCase().includes(s) && !(q.doc_number ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "az") return a.client_name.localeCompare(b.client_name);
      if (sort === "number") return quoteNo(a) - quoteNo(b);
      return (b.created_at ?? b.issue_date ?? "").localeCompare(a.created_at ?? a.issue_date ?? "");
    });

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Quotes</h1>
        </div>
        {access.canEdit && (
          <button
            onClick={() => setShowNew(true)}
            style={{ background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + New
          </button>
        )}
      </div>

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="quotes" />}

      {!isLoading && (quotes ?? []).length > 0 && (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quotes..."
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1.5px solid #e2e8f0",
              fontSize: 14,
              boxSizing: "border-box",
              marginBottom: 12,
              background: "#fff",
            }}
          />

          {presentStatuses.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {["all", ...presentStatuses].map((s) => {
                const active = statusFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 20,
                      border: `1.5px solid ${active ? "#0C4A6E" : "#e2e8f0"}`,
                      background: active ? "#0C4A6E" : "#fff",
                      color: active ? "#fff" : "#374151",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {s === "all" ? "All" : s}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (quotes ?? []).length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No quotes yet.</p>
      )}
      {!isLoading && (quotes ?? []).length > 0 && filtered.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No quotes match your search.</p>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "0 0 10px 2px" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {filtered.length}
            {filtered.length !== (quotes ?? []).length ? ` of ${(quotes ?? []).length}` : ""} quote{(quotes ?? []).length === 1 ? "" : "s"}
          </span>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
            {(["az", "number", "recent"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: sort === s ? "#fff" : "transparent",
                  color: sort === s ? "#0C4A6E" : "#64748b",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: sort === s ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                {s === "az" ? "A–Z" : s === "number" ? "Number" : "Recent"}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.map((q) => {
        const color = STATUS_COLORS[q.status] ?? STATUS_COLORS.pending;
        const totalInclVat = Number(q.total_amount) + Number(q.vat_amount ?? 0);
        return (
          <button
            key={q.id}
            onClick={() => setSelected(q)}
            style={{
              width: "100%",
              background: "#fff",
              borderRadius: 13,
              padding: "12px 14px",
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{q.client_name}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {q.doc_number} · {q.issue_date}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#0C4A6E" }}>{fmt(totalInclVat)}</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: color.bg, color: color.fg, textTransform: "uppercase" }}>
                {q.status}
              </span>
            </div>
          </button>
        );
      })}

      {showNew && <QuoteModal onClose={() => setShowNew(false)} />}
      {selected && <QuoteActionsModal quote={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
