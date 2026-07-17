"use client";

import { useState } from "react";
import { useMileageTrips, useUpdateMileageTrip } from "@/lib/supabase/hooks/useMileage";
import { MileageModal } from "@/components/modals/MileageModal";
import { fmt } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { BackLink } from "@/components/ui/BackLink";

export function MileageView() {
  const access = useToolAccess("mileage");
  const { data: trips, isLoading } = useMileageTrips();
  const updateTrip = useUpdateMileageTrip();
  const [showNew, setShowNew] = useState(false);

  const totalKm = (trips ?? []).reduce((s, t) => s + Number(t.km_travelled || 0), 0);
  const totalDeduction = (trips ?? []).reduce((s, t) => s + Number(t.sars_deduction || 0), 0);

  const handleSoftDelete = (id: string) => {
    if (!confirm("Remove this trip?")) return;
    updateTrip.mutate({ id, changes: { deleted_at: new Date().toISOString() } });
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Mileage</h1>
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

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="trips" />}

      {(trips ?? []).length > 0 && (
        <div style={{ background: "#F0F9FF", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#0369A1", display: "flex", justifyContent: "space-between" }}>
          <span>{totalKm.toFixed(1)} km total</span>
          <span>
            SARS deduction: <strong>{fmt(totalDeduction)}</strong>
          </span>
        </div>
      )}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (trips ?? []).length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No trips logged yet.</p>
      )}

      {(trips ?? []).map((t) => (
        <div
          key={t.id}
          style={{
            background: "#fff",
            borderRadius: 13,
            padding: "12px 14px",
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
              {t.trip_type || "Trip"}
              {t.purpose ? ` — ${t.purpose}` : ""}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {t.trip_date} · {Number(t.km_travelled).toFixed(1)} km · {fmt(t.sars_deduction)}
            </div>
          </div>
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
      ))}

      {showNew && <MileageModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
