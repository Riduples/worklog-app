"use client";

import { useState } from "react";
import { useMileageTrips } from "@/lib/supabase/hooks/useMileage";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useLogbookYears } from "@/lib/supabase/hooks/useLogbook";
import { useTrialState } from "@/lib/supabase/hooks/useSubscription";
import { shareReport } from "@/lib/docgen/shareReport";
import { buildTravelReportHTML, type TravelLogbook } from "@/lib/docgen/buildLedgerHTML";
import { openDocumentForPrinting } from "@/lib/docgen/shareDocument";
import { renderPdf, downloadBlob } from "@/lib/docgen/renderPdf";
import { fmt, todayStr } from "@/lib/format";
import {
  inPeriod,
  type Period,
  currentTaxYearStartYear,
  taxYearStartYearOf,
  taxYearRange,
  taxYearDateLabel,
} from "@/lib/period";

// Trip types shown in this order; only types actually used get a section.
const TYPE_ORDER = ["Customer visit", "Supplier visit", "Other"];

// The Travel tab reads by period. "Tax year" (the default) is the SARS logbook
// view — 1 Mar–28/29 Feb, matched to the annual odometer — and stays local rather
// than in the shared Period enum so it doesn't sprout on other reports' selectors.
// The rest reuse the shared calendar periods.
type TravelPeriod = "taxyear" | "month" | "year" | "all";
const PERIOD_OPTS: { id: TravelPeriod; label: string }[] = [
  { id: "taxyear", label: "Tax year" },
  { id: "month", label: "This month" },
  { id: "year", label: "Calendar year" },
  { id: "all", label: "All time" },
];
const labelOf = (p: TravelPeriod) => PERIOD_OPTS.find((o) => o.id === p)!.label;

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1.5px solid #e2e8f0",
  fontSize: 14,
  fontFamily: "inherit",
  background: "#fff",
  boxSizing: "border-box",
  marginBottom: 14,
};

// The Travel tab of the Time & Travel Reports tool — the summarised, printable
// version of the Travel Log: total kilometres and SARS deduction, grouped by
// trip type, for tax records.
export function TravelReport() {
  const { data: trips } = useMileageTrips();
  const { data: business } = useBusinessProfile();
  const { data: logbookYears } = useLogbookYears();
  const { isTrialing, isReadOnly } = useTrialState();
  const watermark = isTrialing || isReadOnly;
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState<TravelPeriod>("taxyear");
  // null = follow the default (latest tax year that has trips); a number is the
  // user's explicit pick.
  const [pickedTaxYear, setPickedTaxYear] = useState<number | null>(null);

  // Which tax years to offer: any with trips or stored readings, plus the current
  // one, newest first. The default view lands on the latest year that has trips so
  // someone filing last year's return sees it without hunting.
  const tripTaxYears = [...new Set((trips ?? []).map((t) => taxYearStartYearOf(t.trip_date ?? "")))].filter((n) => !Number.isNaN(n));
  const latestWithData = tripTaxYears.length ? Math.max(...tripTaxYears) : currentTaxYearStartYear();
  const taxYearStart = pickedTaxYear ?? latestWithData;
  const taxYearSet = new Set<number>([currentTaxYearStartYear(), ...tripTaxYears, ...(logbookYears ?? []).map((r) => taxYearStartYearOf(r.tax_year_start))]);
  const taxYearOptions = [...taxYearSet].sort((a, b) => b - a);

  // The active date window: the chosen tax year for the logbook view, otherwise a
  // shared calendar period.
  const taxRange = taxYearRange(taxYearStart);
  const within = period === "taxyear" ? (d: string) => d >= taxRange.from && d <= taxRange.to : inPeriod(period as Period);

  const all = [...(trips ?? [])]
    .filter((t) => within(t.trip_date ?? ""))
    .sort((a, b) => (b.trip_date ?? "").localeCompare(a.trip_date ?? ""));
  const totalKm = all.reduce((s, t) => s + Number(t.km_travelled || 0), 0);
  const totalDeduction = all.reduce((s, t) => s + Number(t.sars_deduction || 0), 0);

  // ── Annual logbook summary (tax-year view only) ──
  // Business km is read from the trips in the tax year; total km from the annual
  // opening/closing odometer; private km is the difference.
  const logbookRec = (logbookYears ?? []).find((r) => taxYearStartYearOf(r.tax_year_start) === taxYearStart);
  const openingOdo = logbookRec?.opening_odometer != null ? Number(logbookRec.opening_odometer) : null;
  const closingOdo = logbookRec?.closing_odometer != null ? Number(logbookRec.closing_odometer) : null;
  const yearTotalKm = openingOdo != null && closingOdo != null ? closingOdo - openingOdo : null;
  const businessKm = totalKm; // in the tax-year view, `all` already scopes to this tax year
  const privateKm = yearTotalKm != null ? Math.max(0, yearTotalKm - businessKm) : null;
  const businessPct = yearTotalKm && yearTotalKm > 0 ? (businessKm / yearTotalKm) * 100 : null;
  const hasLogbookSetup = !!(business?.vehicle_description || business?.vehicle_registration) || openingOdo != null || closingOdo != null;

  // The logbook block only rides along on the tax-year view (it's a tax-year
  // statement, meaningless stapled to a calendar month) and only once the vehicle
  // or odometer has been set up — otherwise the PDF would print an empty scaffold.
  const logbook: TravelLogbook | null =
    period === "taxyear" && hasLogbookSetup
      ? {
          vehicle: business?.vehicle_description ?? "",
          registration: business?.vehicle_registration ?? "",
          taxYearLabel: taxYearDateLabel(taxYearStart),
          openingOdo,
          closingOdo,
          totalKm: yearTotalKm,
          businessKm,
          privateKm,
          businessPct,
        }
      : null;

  const periodLabel = period === "taxyear" ? `Tax year ${taxYearDateLabel(taxYearStart)}` : labelOf(period);

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
    // Opening/closing odometer readings — SARS's logbook wants both, and they're
    // captured on every trip, so the printable record carries them through.
    odoStart: Number(t.odometer_start || 0),
    odoEnd: Number(t.odometer_end || 0),
    km: Number(t.km_travelled || 0),
    deduction: Number(t.sars_deduction || 0),
  }));
  const pdfTotals = { trips: all.length, km: totalKm, deduction: totalDeduction };

  const handlePrint = async () => {
    if (!business || busy) return;
    setBusy(true);
    const asAt = new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
    try {
      const blob = await renderPdf({ kind: "travelreport", rows: pdfRows, totals: pdfTotals, asAt, periodLabel, logbook });
      downloadBlob(blob, "travel-report");
    } catch {
      openDocumentForPrinting(buildTravelReportHTML(business, pdfRows, pdfTotals, asAt, watermark, periodLabel, logbook), "travel-report");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = () => {
    const lines = [
      `Trips: ${all.length}`,
      `Total distance: ${totalKm.toFixed(1)} km`,
      `SARS deduction: ${fmt(totalDeduction)}`,
    ];
    if (logbook && yearTotalKm != null) {
      lines.push(``, `Logbook — ${logbook.taxYearLabel}`, `Total (year): ${yearTotalKm.toFixed(1)} km · business ${businessKm.toFixed(1)} km${businessPct != null ? ` (${businessPct.toFixed(0)}%)` : ""}`);
    }
    lines.push(``, ...groups.map((g) => `${g.type}: ${g.km.toFixed(1)} km · ${fmt(g.deduction)}`));
    void shareReport("Travel Report", `${periodLabel} · as at ${todayStr()}`, lines, business);
  };

  const hasAnyTrips = (trips ?? []).length > 0;

  return (
    <>
      {/* Period — the SARS logbook view (tax year) is the default; the calendar
          periods are there for quick operational checks. */}
      <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3, marginBottom: 14 }}>
        {PERIOD_OPTS.map((o) => (
          <button
            key={o.id}
            onClick={() => setPeriod(o.id)}
            style={{ flex: 1, padding: "7px 6px", borderRadius: 8, border: "none", background: period === o.id ? "#fff" : "transparent", color: period === o.id ? "#0C4A6E" : "#64748b", fontSize: 11.5, fontWeight: 700, cursor: "pointer", boxShadow: period === o.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Which tax year — only in the logbook view; drives both the trip filter
          and the annual odometer shown below. */}
      {period === "taxyear" && (
        <select value={taxYearStart} onChange={(e) => setPickedTaxYear(Number(e.target.value))} style={selectStyle}>
          {taxYearOptions.map((y) => (
            <option key={y} value={y}>
              {taxYearDateLabel(y)}
            </option>
          ))}
        </select>
      )}

      {/* Annual logbook summary — the SARS piece on top of the trip list. */}
      {period === "taxyear" &&
        (hasLogbookSetup ? (
          <div style={{ background: "#fff", border: "1.5px solid #BAE6FD", borderRadius: 14, padding: "14px 16px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#0C4A6E", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Logbook · {taxYearDateLabel(taxYearStart)}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 10 }}>
              {business?.vehicle_description || "Vehicle not set"}
              {business?.vehicle_registration ? ` · ${business.vehicle_registration}` : ""}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {[
                { label: "Opening", value: openingOdo != null ? openingOdo.toFixed(0) : "—" },
                { label: "Closing", value: closingOdo != null ? closingOdo.toFixed(0) : "—" },
                { label: "Total (year)", value: yearTotalKm != null ? `${yearTotalKm.toFixed(0)} km` : "—" },
                { label: "Business", value: `${businessKm.toFixed(0)} km` },
                { label: "Private", value: privateKm != null ? `${privateKm.toFixed(0)} km` : "—" },
                { label: "Business use", value: businessPct != null ? `${businessPct.toFixed(0)}%` : "—" },
              ].map((c) => (
                <div key={c.label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.2, marginBottom: 3 }}>{c.label}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0C4A6E" }}>{c.value}</div>
                </div>
              ))}
            </div>
            {(openingOdo == null || closingOdo == null) && (
              <div style={{ fontSize: 11, color: "#b45309", marginTop: 10 }}>
                Add the opening &amp; closing odometer in Travel Log → 🚗 Vehicle &amp; logbook to complete the year.
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1.5px dashed #cbd5e1", borderRadius: 14, padding: "16px", marginBottom: 16, fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, color: "#0C4A6E", marginBottom: 4 }}>Complete your SARS logbook</div>
            In the Travel Log, tap <strong>🚗 Vehicle &amp; logbook</strong> to add your vehicle and this year&apos;s opening &amp; closing odometer. It then prints on this report.
          </div>
        ))}

      {all.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", margin: "40px 0" }}>
          {hasAnyTrips ? `No trips in ${period === "taxyear" ? "this tax year" : labelOf(period).toLowerCase()}.` : "No trips logged yet."}
        </p>
      )}

      {all.length > 0 && (
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
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  {t.trip_date} · odo {Number(t.odometer_start).toFixed(0)}→{Number(t.odometer_end).toFixed(0)} · {Number(t.km_travelled).toFixed(1)} km
                </div>
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
      )}
    </>
  );
}
