"use client";

import { useState } from "react";
import { useBusinessProfile, type BusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTrialState } from "@/lib/supabase/hooks/useSubscription";
import { shareReport } from "@/lib/docgen/shareReport";
import { openDocumentForPrinting } from "@/lib/docgen/shareDocument";
import { renderPdf, downloadBlob, type RenderPdfBody } from "@/lib/docgen/renderPdf";
import { exportCsv, type CsvExport } from "@/lib/docgen/exportCsv";
import { BackLink } from "@/components/ui/BackLink";
import { PERIOD_LABELS, type Period } from "@/lib/period";

// The furniture every reports tool repeats: the tab bar, the period selector, the
// stat tiles and the Download PDF / Share pair. Payroll Reports and Time & Travel
// Reports each hand-rolled these; pulling them out is what keeps a sixth reports
// tool from being a sixth interpretation of the same screen.

export type ReportTab = {
  id: string;
  label: string;
  /**
   * Whether this member may see the tab — the caller works it out with
   * useToolAccess at the top of its own component, so the hooks run
   * unconditionally and in a fixed order however the tab list is built.
   */
  show: boolean;
  render: () => React.ReactNode;
};

/**
 * A reports tool: title, tabs, and nothing else.
 *
 * Tabs a member cannot view are absent rather than empty. RLS returns no rows for
 * a tool they lack, and a blank report reads as "no data" instead of "not yours".
 */
export function ReportsTool({ title, tabs, loading = false }: { title: string; tabs: ReportTab[]; loading?: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  const allowed = tabs.filter((t) => t.show);

  const active = picked && allowed.some((t) => t.id === picked) ? picked : allowed[0]?.id ?? null;

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <BackLink />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 16px" }}>{title}</h1>

      {allowed.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {allowed.map((t) => (
            <button
              key={t.id}
              onClick={() => setPicked(t.id)}
              style={{
                padding: "8px 14px",
                borderRadius: 20,
                border: `1.5px solid ${active === t.id ? "#0C4A6E" : "#e2e8f0"}`,
                background: active === t.id ? "#0C4A6E" : "#fff",
                color: active === t.id ? "#fff" : "#374151",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {loading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!loading && active === null && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>
          You don&apos;t have access to any of the tools these reports read.
        </p>
      )}
      {allowed.find((t) => t.id === active)?.render()}
    </div>
  );
}

/** The one-line explainer that opens every tab. */
export function ReportIntro({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 2px 12px" }}>{children}</p>;
}

export type Tile = { label: string; value: string; tone?: "sky" | "amber" | "plain" | "bad" | "good" };

const TONES = {
  sky: { color: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD" },
  amber: { color: "#92400e", bg: "#fff7ed", border: "#fed7aa" },
  plain: { color: "#0f172a", bg: "#f8fafc", border: "#e2e8f0" },
  bad: { color: "#be123c", bg: "#fff1f2", border: "#fecdd3" },
  good: { color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
};

/** The three-across figure row every report opens with. */
export function StatTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(tiles.length, 3)},1fr)`, gap: 6, marginBottom: 14 }}>
      {tiles.map((t) => {
        const tone = TONES[t.tone ?? "plain"];
        return (
          <div key={t.label} style={{ background: tone.bg, border: `1.5px solid ${tone.border}`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: tone.color, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>{t.label}</div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: tone.color }}>{t.value}</div>
          </div>
        );
      })}
    </div>
  );
}

/** The segmented period picker, matching the one on the Travel report. */
export function PeriodPicker({
  period,
  onChange,
  options = ["month", "year", "all"],
}: {
  period: Period;
  onChange: (p: Period) => void;
  options?: Period[];
}) {
  return (
    <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3, marginBottom: 14 }}>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          style={{ flex: 1, padding: "7px 6px", borderRadius: 8, border: "none", background: period === o ? "#fff" : "transparent", color: period === o ? "#0C4A6E" : "#64748b", fontSize: 11.5, fontWeight: 700, cursor: "pointer", boxShadow: period === o ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
        >
          {PERIOD_LABELS[o]}
        </button>
      ))}
    </div>
  );
}

/** A section heading with its own total on the right. */
export function ReportGroupHeading({ label, right }: { label: string; right?: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "#0C4A6E", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 4, display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span>{label}</span>
      {right && <span>{right}</span>}
    </div>
  );
}

/** One line of a report list: a title, a sub-line, and a figure on the right. */
export function ReportRow({
  title,
  sub,
  value,
  valueSub,
  valueColor = "#0C4A6E",
  dim,
  children,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  value?: string;
  valueSub?: string;
  valueColor?: string;
  dim?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginBottom: 6, opacity: dim ? 0.6 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{title}</div>
          {sub && <div style={{ fontSize: 11, color: "#94a3b8" }}>{sub}</div>}
        </div>
        {value && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: valueColor }}>{value}</div>
            {valueSub && <div style={{ fontSize: 10, color: "#94a3b8" }}>{valueSub}</div>}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export function EmptyReport({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", margin: "40px 0" }}>{children}</p>;
}

/**
 * Download PDF / Share, and the fallback between them.
 *
 * `pdf` builds the structured body the render-pdf route rebuilds our own template
 * from — the client never sends HTML. `fallbackHtml` is the same document built
 * locally for window.print(), used when Chromium is cold, timed out, or absent.
 */
export function ReportActions({
  pdf,
  filename,
  fallbackHtml,
  share,
  csv,
}: {
  pdf: () => RenderPdfBody;
  filename: string;
  fallbackHtml: (business: BusinessProfile, watermark: boolean) => string;
  share: () => { title: string; subtitle: string; lines: string[] };
  /**
   * When given, an "Export CSV" button appears under Download PDF / Share — the
   * data behind the report as a spreadsheet, the mirror of the CSV import. The
   * callback runs at click time so the file always holds the current view.
   */
  csv?: () => CsvExport;
}) {
  const { data: business } = useBusinessProfile();
  const { isTrialing, isReadOnly } = useTrialState();
  const [busy, setBusy] = useState(false);

  const handlePrint = async () => {
    if (!business || busy) return;
    setBusy(true);
    try {
      const blob = await renderPdf(pdf());
      downloadBlob(blob, filename);
    } catch {
      openDocumentForPrinting(fallbackHtml(business, isTrialing || isReadOnly), filename);
    } finally {
      setBusy(false);
    }
  };

  const handleShare = () => {
    const s = share();
    void shareReport(s.title, s.subtitle, s.lines, business);
  };

  const btn: React.CSSProperties = {
    flex: 1,
    background: "#F0F9FF",
    color: "#0C4A6E",
    border: "1.5px solid #BAE6FD",
    borderRadius: 12,
    padding: 13,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={handlePrint} disabled={!business || busy} style={btn}>
          {busy ? "📄 Preparing..." : "📄 Download PDF"}
        </button>
        <button onClick={handleShare} style={btn}>
          📤 Share
        </button>
      </div>
      {csv && (
        <button onClick={() => exportCsv(csv())} style={{ ...btn, width: "100%", flex: "none", marginTop: 10 }}>
          ⬇ Export CSV
        </button>
      )}
    </div>
  );
}

/**
 * The standalone Export CSV button, for the reports that hand-roll their own
 * Download PDF / Share pair rather than going through ReportActions. Same look as
 * the buttons beside it, so a report gains export without changing its layout.
 */
export function ExportCsvButton({ csv, style }: { csv: () => CsvExport; style?: React.CSSProperties }) {
  return (
    <button
      onClick={() => exportCsv(csv())}
      style={{
        width: "100%",
        background: "#F0F9FF",
        color: "#0C4A6E",
        border: "1.5px solid #BAE6FD",
        borderRadius: 12,
        padding: 13,
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
        ...style,
      }}
    >
      ⬇ Export CSV
    </button>
  );
}

/** The date every report stamps itself with, in the format the templates print. */
export const asAtLabel = () => new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
