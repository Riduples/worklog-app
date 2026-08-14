"use client";

import { useState } from "react";
import { useWorkerLeave, type WorkerLeaveRecord } from "@/lib/supabase/hooks/useWorkerLeave";
import { LeaveModal } from "@/components/modals/LeaveModal";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { BackLink } from "@/components/ui/BackLink";

// Known leave types in display order; anything else falls to the end under its
// own pill, matching how the other list tools order their type filters.
const LEAVE_TYPE_ORDER = ["Annual", "Sick", "Family", "Unpaid", "Maternity", "Parental"];

type LeaveRow = {
  key: string;
  record?: WorkerLeaveRecord; // present (and editable) for manual entries only
  worker_name: string;
  leave_type: string;
  days: number;
  start_date: string;
  end_date: string | null;
  note: string | null;
};

export function LeaveView() {
  const access = useToolAccess("leave");
  const { data: leaveRecords, isLoading } = useWorkerLeave();

  const [modal, setModal] = useState<{ open: boolean; leave?: WorkerLeaveRecord }>({ open: false });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sort, setSort] = useState<"recent" | "az">("recent");

  // worker_leave is the single source of truth. create_pay_run already writes a
  // real leave row for the leave a pay run books, so we render those directly and
  // mark them read-only (record undefined) — rather than synthesizing a second
  // copy from the pay runs, which double-listed the leave here and double-counted
  // it in the balance (see LeaveModal).
  const rows: LeaveRow[] = (leaveRecords ?? []).map((l) => ({
    key: `leave-${l.id}`,
    record: l.pay_run_id ? undefined : l, // leave booked by Pay Run is read-only here
    worker_name: l.worker_name,
    leave_type: l.leave_type,
    days: l.days,
    start_date: l.start_date,
    end_date: l.end_date,
    note: l.pay_run_id ? "from Pay Run" : l.note,
  }));

  const presentTypes = [
    ...LEAVE_TYPE_ORDER.filter((t) => rows.some((r) => r.leave_type === t)),
    ...[...new Set(rows.map((r) => r.leave_type))].filter((t) => !LEAVE_TYPE_ORDER.includes(t)),
  ];

  const filtered = rows.filter((r) => {
    if (typeFilter !== "all" && r.leave_type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!`${r.worker_name} ${r.leave_type} ${r.note ?? ""}`.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) =>
    sort === "az"
      ? a.worker_name.localeCompare(b.worker_name) || new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      : new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Leave</h1>
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

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="leave" />}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && rows.length === 0 && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: 20, textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏖️</div>
          <div style={{ fontSize: 14, color: "#64748b" }}>
            No leave recorded yet.{access.canEdit ? " Tap “+ New” to record some." : ""}
          </div>
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search leave..."
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, boxSizing: "border-box", marginBottom: 12, background: "#fff" }}
        />
      )}

      {presentTypes.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {["all", ...presentTypes].map((t) => {
            const active = typeFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                style={{ padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${active ? "#0C4A6E" : "#e2e8f0"}`, background: active ? "#0C4A6E" : "#fff", color: active ? "#fff" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {t === "all" ? "All" : t}
              </button>
            );
          })}
        </div>
      )}

      {!isLoading && rows.length > 0 && filtered.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No leave matches your search.</p>
      )}

      {sorted.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "0 0 10px 2px" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {sorted.length}
            {sorted.length !== rows.length ? ` of ${rows.length}` : ""} entr{rows.length === 1 ? "y" : "ies"}
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

      {sorted.map((r) => {
        const body = (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{r.worker_name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {r.end_date ? `${r.start_date} → ${r.end_date}` : r.start_date} · {r.leave_type} leave
              {r.note ? ` · ${r.note}` : ""}
            </div>
          </>
        );
        // Only manually-recorded leave is editable; Pay Run leave is a pay-run record.
        const tappable = access.canEdit && !!r.record;
        return (
          <div
            key={r.key}
            style={{ background: "#fff", borderRadius: 13, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            {tappable ? (
              <button
                onClick={() => setModal({ open: true, leave: r.record })}
                style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", flex: 1, padding: 0 }}
                aria-label="Edit leave"
              >
                {body}
              </button>
            ) : (
              <div style={{ flex: 1 }}>{body}</div>
            )}
            <span style={{ fontSize: 15, fontWeight: 800, color: "#0C4A6E", marginLeft: 8, whiteSpace: "nowrap" }}>{r.days}d</span>
          </div>
        );
      })}

      {modal.open && <LeaveModal leave={modal.leave} onClose={() => setModal({ open: false })} />}
    </div>
  );
}
