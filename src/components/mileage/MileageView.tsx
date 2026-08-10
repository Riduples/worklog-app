"use client";

import { useState } from "react";
import { useMileageTrips, useUpdateMileageTrip, type MileageTrip } from "@/lib/supabase/hooks/useMileage";
import { MileageModal } from "@/components/modals/MileageModal";
import { fmt } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { BackLink } from "@/components/ui/BackLink";

// Trip types the modal records, coloured for the list badge; anything else falls
// back to the "Other" slate.
const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  "Customer visit": { bg: "#F0F9FF", fg: "#0369A1" },
  "Supplier visit": { bg: "#fff7ed", fg: "#b45309" },
  Other: { bg: "#f1f5f9", fg: "#64748b" },
};
const TYPE_ORDER = ["Customer visit", "Supplier visit", "Other"];

export function MileageView() {
  const access = useToolAccess("mileage");
  const { data: trips, isLoading } = useMileageTrips();
  const updateTrip = useUpdateMileageTrip();
  const [modalState, setModalState] = useState<{ open: boolean; trip?: MileageTrip }>({ open: false });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sort, setSort] = useState<"az" | "recent">("recent");

  const all = trips ?? [];
  const presentTypes = TYPE_ORDER.filter((t) => all.some((x) => (x.trip_type || "Other") === t));

  const filtered = all
    .filter((t) => {
      if (typeFilter !== "all" && (t.trip_type || "Other") !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!`${t.trip_type ?? ""} ${t.purpose ?? ""}`.toLowerCase().includes(s)) return false;
      }
      return true;
    })
    .sort((a, b) =>
      sort === "az"
        ? (a.purpose || a.trip_type || "").localeCompare(b.purpose || b.trip_type || "")
        : (b.trip_date ?? "").localeCompare(a.trip_date ?? "")
    );

  const handleSoftDelete = (id: string) => {
    if (!confirm("Remove this trip?")) return;
    updateTrip.mutate({ id, changes: { deleted_at: new Date().toISOString() } });
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Travel Log</h1>
        </div>
        {access.canEdit && (
          <button
            onClick={() => setModalState({ open: true })}
            style={{ background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + New
          </button>
        )}
      </div>

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="trips" />}

      {!isLoading && all.length > 0 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search trips..."
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

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && all.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No trips logged yet.</p>
      )}
      {!isLoading && all.length > 0 && filtered.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No trips match your search.</p>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "0 0 10px 2px" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {filtered.length}
            {filtered.length !== all.length ? ` of ${all.length}` : ""} trip{all.length === 1 ? "" : "s"}
          </span>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
            {(["recent", "az"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: sort === s ? "#fff" : "transparent", color: sort === s ? "#0C4A6E" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: sort === s ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
              >
                {s === "recent" ? "Recent" : "A–Z"}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.map((t) => {
        const type = t.trip_type || "Other";
        const color = TYPE_COLORS[type] ?? TYPE_COLORS.Other;
        const body = (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{t.purpose || type}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {t.trip_date} · {Number(t.km_travelled).toFixed(1)} km · {fmt(t.sars_deduction)}
            </div>
          </>
        );
        return (
          <div
            key={t.id}
            style={{ background: "#fff", borderRadius: 13, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            {access.canEdit ? (
              <button
                onClick={() => setModalState({ open: true, trip: t })}
                style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", flex: 1, padding: 0 }}
                aria-label="Open trip"
              >
                {body}
              </button>
            ) : (
              <div style={{ flex: 1 }}>{body}</div>
            )}
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: color.bg, color: color.fg, marginRight: 8, whiteSpace: "nowrap" }}>
              {type}
            </span>
            {access.canDelete && (
              <button
                onClick={() => handleSoftDelete(t.id)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 4 }}
                aria-label="Remove trip"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      {modalState.open && <MileageModal trip={modalState.trip} onClose={() => setModalState({ open: false })} />}
    </div>
  );
}
