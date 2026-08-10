"use client";

import { useState } from "react";
import { useMileageTrips } from "@/lib/supabase/hooks/useMileage";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTrialState } from "@/lib/supabase/hooks/useSubscription";
import { shareReport } from "@/lib/docgen/shareReport";
import { buildTravelReportHTML } from "@/lib/docgen/buildLedgerHTML";
import { openDocumentForPrinting } from "@/lib/docgen/shareDocument";
import { renderPdf, downloadBlob } from "@/lib/docgen/renderPdf";
import { fmt, todayStr } from "@/lib/format";

// Trip types shown in this order; only types actually used get a section.
const TYPE_ORDER = ["Customer visit", "Supplier visit", "Other"];

// The Travel tab of the Time & Travel Reports tool — the summarised, printable
// version of the Travel Log: total kilometres and SARS deduction, grouped by
// trip type, for tax records.
export function TravelReport() {
  const { data: trips } = useMileageTrips();
  const { data: business } = useBusinessProfile();
  const { isTrialing, isReadOnly } = useTrialState();
  const watermark = isTrialing || isReadOnly;
  const [busy, setBusy] = useState(false);

  const all = [...(trips ?? [])].sort((a, b) => (b.trip_date ?? "").localeCompare(a.trip_date ?? ""));
  const totalKm = all.reduce((s, t) => s + Number(t.km_travelled || 0), 0);
  const totalDeduction = all.reduce((s, t) => s + Number(t.sars_deduction || 0), 0);

  const presentTypes = TYPE_ORDER.filter((t) => all.some((x) => (x.trip_type || "Other") === t));
  // Any stray type not in TYPE_ORDER still gets shown under its own heading.
  const extraTypes = [...new Set(all.map((t) => t.trip_type || "Other"))].filter((t) => !TYPE_ORDER.includes(t));
  const groups = [...presentTypes, ...extraTypes].map((type) => {
    const rows = all.filter((t) => (t.trip_type || "Other") === type);
    return {
      type,
      rows,
      km: rows.reduce((s, t) => s + Number(t.km_travelled || 0), 0),
      deduction: rows.reduce((s, t) => s + Number(t.sars_deduction || 0), 0),
    };
  });

  const pdfRows = all.map((t) => ({
    date: t.trip_date ?? "",
    type: t.trip_type || "Other",
    purpose: t.purpose ?? "",
    km: Number(t.km_travelled || 0),
    deduction: Number(t.sars_deduction || 0),
  }));
  const pdfTotals = { trips: all.length, km: totalKm, deduction: totalDeduction };

  const handlePrint = async () => {
    if (!business || busy) return;
    setBusy(true);
    const asAt = new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
    try {
      const blob = await renderPdf({ kind: "travelreport", rows: pdfRows, totals: pdfTotals, asAt });
      downloadBlob(blob, "travel-report");
    } catch {
      openDocumentForPrinting(buildTravelReportHTML(business, pdfRows, pdfTotals, asAt, watermark), "travel-report");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = () => {
    const lines = [
      `Trips: ${all.length}`,
      `Total distance: ${totalKm.toFixed(1)} km`,
      `SARS deduction: ${fmt(totalDeduction)}`,
      ``,
      ...groups.map((g) => `${g.type}: ${g.km.toFixed(1)} km · ${fmt(g.deduction)}`),
    ];
    void shareReport("Travel Report", `Business travel · as at ${todayStr()}`, lines, business);
  };

  if (all.length === 0) {
    return <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", margin: "40px 0" }}>No trips logged yet.</p>;
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 16 }}>
        {[
          { label: "Trips", value: String(all.length), color: "#0f172a", bg: "#f8fafc", border: "#e2e8f0" },
          { label: "Distance", value: `${totalKm.toFixed(1)} km`, color: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD" },
          { label: "SARS deduction", value: fmt(totalDeduction), color: "#92400e", bg: "#fff7ed", border: "#fed7aa" },
        ].map((c) => (
          <div key={c.label} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: c.color, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>{c.label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g.type} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#0C4A6E", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
            <span>{g.type}</span>
            <span>{g.km.toFixed(1)} km · {fmt(g.deduction)}</span>
          </div>
          {g.rows.map((t) => (
            <div key={t.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{t.purpose || t.trip_type || "Trip"}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{t.trip_date} · {Number(t.km_travelled).toFixed(1)} km</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#92400e", flexShrink: 0, marginLeft: 8 }}>{fmt(t.sars_deduction)}</div>
            </div>
          ))}
        </div>
      ))}

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button
          onClick={handlePrint}
          disabled={!business || busy}
          style={{ flex: 1, background: "#F0F9FF", color: "#0C4A6E", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          {busy ? "📄 Preparing..." : "📄 Download PDF"}
        </button>
        <button
          onClick={handleShare}
          style={{ flex: 1, background: "#F0F9FF", color: "#0C4A6E", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          📤 Share
        </button>
      </div>
    </>
  );
}
