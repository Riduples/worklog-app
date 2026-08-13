"use client";

import { useState } from "react";
import { useStaffRegister } from "@/lib/supabase/hooks/useStaffRegister";
import { useWorkerLoans, type WorkerLoan } from "@/lib/supabase/hooks/useWorkerLoans";
import { AdvanceModal } from "@/components/modals/AdvanceModal";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { fmt } from "@/lib/format";
import { getLoanBalance } from "@/lib/payroll";
import { BackLink } from "@/components/ui/BackLink";

export function AdvancesView() {
  const access = useToolAccess("advances");
  const { data: staff } = useStaffRegister();
  const { data: loans, isLoading } = useWorkerLoans();

  const [modal, setModal] = useState<{ open: boolean; advance?: WorkerLoan }>({ open: false });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "advance" | "repayment">("all");
  const [sort, setSort] = useState<"recent" | "az">("recent");

  const balanceFor = (id: string) => getLoanBalance((loans ?? []).filter((l) => l.staff_id === id));
  const repayPlanFor = (id: string) =>
    (loans ?? [])
      .filter((l) => l.staff_id === id && l.loan_type === "advance" && l.repay_per_run != null && l.repay_per_run > 0)
      .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())[0] ?? null;
  const totalOutstanding = (staff ?? []).reduce((s, w) => s + balanceFor(w.id), 0);

  // The list interleaves advances given with the repayments Pay Run books against
  // them. Advances are editable here; repayment rows are created only by Pay Run,
  // so they show for the record but aren't tappable.
  const entries = loans ?? [];
  const presentTypes = (["advance", "repayment"] as const).filter((t) => entries.some((l) => l.loan_type === t));

  const filtered = entries.filter((l) => {
    if (typeFilter !== "all" && l.loan_type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!`${l.worker_name} ${l.note ?? ""}`.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  // Recent is newest-first by date; A–Z is by employee, with date breaking the tie
  // so one person's entries still read newest-first.
  const sorted = [...filtered].sort((a, b) =>
    sort === "az"
      ? a.worker_name.localeCompare(b.worker_name) || new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
      : new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
  );

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Advances</h1>
        </div>
        {access.canEdit && (
          <button
            onClick={() => setModal({ open: true })}
            style={{ background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + New
          </button>
        )}
      </div>

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="advances" />}

      {totalOutstanding > 0 && (
        <div style={{ background: "#0C4A6E", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#38BDF8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Outstanding advances</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 8 }}>{fmt(totalOutstanding)} total</div>
          {(staff ?? [])
            .filter((w) => balanceFor(w.id) > 0)
            .map((w) => {
              const bal = balanceFor(w.id);
              const plan = repayPlanFor(w.id);
              return (
                <div key={w.id} style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 6, marginTop: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "#7DD3FC" }}>{w.full_name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#F59E0B" }}>{fmt(bal)}</span>
                  </div>
                  {plan && plan.repay_per_run != null && (
                    <div style={{ fontSize: 11, color: "#7DD3FC", marginTop: 2, textAlign: "right" }}>
                      🔁 {fmt(plan.repay_per_run)}/pay run · ~{Math.ceil(bal / plan.repay_per_run)} runs left
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && entries.length === 0 && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: 20, textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
          <div style={{ fontSize: 14, color: "#64748b" }}>
            No advances yet.{access.canEdit ? " Tap “+ New” to record one." : ""}
          </div>
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search advances..."
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, boxSizing: "border-box", marginBottom: 12, background: "#fff" }}
        />
      )}

      {/* Type pills appear once repayments exist, so the advances-only view still
          stays clean until Pay Run has booked its first deduction. */}
      {presentTypes.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {(["all", "advance", "repayment"] as const).map((t) => {
            const active = typeFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                style={{ padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${active ? "#0C4A6E" : "#e2e8f0"}`, background: active ? "#0C4A6E" : "#fff", color: active ? "#fff" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {t === "all" ? "All" : t === "advance" ? "Advances" : "Repayments"}
              </button>
            );
          })}
        </div>
      )}

      {!isLoading && entries.length > 0 && filtered.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No entries match your search.</p>
      )}

      {sorted.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "0 0 10px 2px" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {sorted.length}
            {sorted.length !== entries.length ? ` of ${entries.length}` : ""} entr{entries.length === 1 ? "y" : "ies"}
          </span>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
            {(["recent", "az"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: sort === s ? "#fff" : "transparent", color: sort === s ? "#0C4A6E" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: sort === s ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
              >
                {s === "az" ? "A–Z" : "Recent"}
              </button>
            ))}
          </div>
        </div>
      )}

      {sorted.map((l) => {
        const isAdvance = l.loan_type === "advance";
        const body = (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{l.worker_name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {l.entry_date} · {isAdvance ? "Advance given" : "Repaid from wages"}
              {l.note ? ` · ${l.note}` : ""}
              {isAdvance && l.repay_per_run != null && l.repay_per_run > 0 ? ` · 🔁 ${fmt(l.repay_per_run)}/run` : ""}
            </div>
          </>
        );
        // Only advances are editable here; a repayment is a Pay Run record.
        const tappable = access.canEdit && isAdvance;
        const amountEl = (
          <span style={{ fontSize: 15, fontWeight: 800, color: isAdvance ? "#b45309" : "#0C4A6E", marginLeft: 8, whiteSpace: "nowrap" }}>
            {isAdvance ? "+" : "−"}
            {fmt(l.amount)}
          </span>
        );
        return (
          <div
            key={l.id}
            style={{ background: "#fff", borderRadius: 13, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            {tappable ? (
              <button
                onClick={() => setModal({ open: true, advance: l })}
                style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", flex: 1, padding: 0 }}
                aria-label="Edit advance"
              >
                {body}
              </button>
            ) : (
              <div style={{ flex: 1 }}>{body}</div>
            )}
            {amountEl}
          </div>
        );
      })}

      {modal.open && <AdvanceModal advance={modal.advance} onClose={() => setModal({ open: false })} />}
    </div>
  );
}
