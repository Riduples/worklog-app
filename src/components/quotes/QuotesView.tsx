"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuotes, type Quote } from "@/lib/supabase/hooks/useQuotes";
import { QuoteModal } from "@/components/modals/QuoteModal";
import { QuoteActionsModal } from "@/components/modals/QuoteActionsModal";
import { fmt } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "#fff7ed", fg: "#b45309" },
  accepted: { bg: "#f0fdf4", fg: "#166534" },
  converted: { bg: "#e0f2fe", fg: "#0369a1" },
  declined: { bg: "#fee2e2", fg: "#991b1b" },
};

export function QuotesView() {
  const access = useToolAccess("quote");
  const { data: quotes, isLoading } = useQuotes();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Quote | null>(null);

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <Link href="/dashboard" style={{ fontSize: 12, color: "#64748b" }}>
            ← Dashboard
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1B4332", margin: "4px 0 0" }}>Quotes</h1>
        </div>
        {access.canEdit && (
          <button
            onClick={() => setShowNew(true)}
            style={{ background: "#1B4332", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + New
          </button>
        )}
      </div>

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="quotes" />}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (quotes ?? []).length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No quotes yet.</p>
      )}

      {(quotes ?? []).map((q) => {
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
              <div style={{ fontWeight: 800, fontSize: 15, color: "#1B4332" }}>{fmt(totalInclVat)}</div>
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
