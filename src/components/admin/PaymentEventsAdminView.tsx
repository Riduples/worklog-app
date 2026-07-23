"use client";

import { useState } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { useAdminPaymentEvents, type AdminPaymentEvent } from "@/lib/supabase/hooks/useAdminData";

const field = (payload: unknown, key: string): string => {
  const o = (payload ?? {}) as Record<string, unknown>;
  const v = o[key];
  return v == null ? "" : String(v);
};

export function PaymentEventsAdminView() {
  const { data: events } = useAdminPaymentEvents();
  const [open, setOpen] = useState<string | null>(null);
  const list = events ?? [];

  return (
    <div style={{ padding: "20px 16px 100px", maxWidth: 820, margin: "0 auto" }}>
      <AdminNav active="payments" />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", marginBottom: 4 }}>
        Payment events <span style={{ fontSize: 14, color: "#94a3b8", fontWeight: 600 }}>({list.length})</span>
      </h1>
      <p style={{ fontSize: 12.5, color: "#64748b", marginBottom: 16, lineHeight: 1.5 }}>
        The PayFast ITN audit trail — every server-to-server notification, logged before it&apos;s acted on. Use it to debug
        &quot;paid but nothing activated&quot;: a COMPLETE event with a valid signature should have flipped the subscription to active.
      </p>

      {list.length === 0 && (
        <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 20, textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
          No payment events yet — PayFast writes one here on each transaction.
        </div>
      )}

      {list.map((e) => (
        <EventRow key={e.id} e={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
      ))}
    </div>
  );
}

function EventRow({ e, open, onToggle }: { e: AdminPaymentEvent; open: boolean; onToggle: () => void }) {
  const status = field(e.raw_payload, "payment_status") || e.event_type || "?";
  const amount = field(e.raw_payload, "amount_gross");
  const complete = status === "COMPLETE";

  return (
    <div style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "12px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontFamily: "inherit" }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: complete ? "#166534" : "#92400E" }}>{status}</span>
            <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 8, padding: "2px 8px", background: e.signature_valid ? "#DCFCE7" : "#FEE2E2", color: e.signature_valid ? "#166534" : "#991B1B" }}>
              {e.signature_valid ? "✓ signature" : "✗ signature"}
            </span>
            {amount && <span style={{ fontSize: 12, color: "#64748b" }}>R{amount}</span>}
          </div>
          <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 3 }}>
            {e.business_name ?? "unknown business"} · {new Date(e.processed_at).toLocaleString("en-ZA")}
            {e.source_ip ? ` · ${e.source_ip}` : ""}
          </div>
        </div>
        <span style={{ fontSize: 16, color: "#cbd5e1", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</span>
      </button>
      {open && (
        <pre style={{ margin: 0, padding: "12px 14px", background: "#0f172a", color: "#e2e8f0", fontSize: 11, lineHeight: 1.5, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {JSON.stringify(e.raw_payload, null, 2)}
        </pre>
      )}
    </div>
  );
}
