"use client";

import { useState } from "react";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useTrialState } from "@/lib/supabase/hooks/useSubscription";
import { useTaxFilings, useMarkFiled, useUnmarkFiled, type FilingType } from "@/lib/supabase/hooks/useTaxFilings";
import { renderPdf, downloadBlob, type RenderPdfBody } from "@/lib/docgen/renderPdf";
import { openDocumentForPrinting } from "@/lib/docgen/shareDocument";
import { fmt } from "@/lib/format";
import type { BusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";

// The action strip every statutory-return screen ends with: mark-as-filed, an
// "undo" for a mistaken mark, Download PDF / Share, and the SARS/Labour caveat.
// EMP201, VAT201, the UIF declaration, COIDA and EMP501 all repeat it verbatim,
// so it lives here once — the same reason ReportShell exists for the reports.
//
// Filing is only ever a marker row (tax_filings); it never touched eFiling, so
// undo just deletes that row — nothing else has to be reversed, unlike voiding a
// pay run.
export function FilingActions({
  filingType,
  periodLabel,
  amount,
  markLabel,
  note,
  filename,
  pdf,
  fallbackHtml,
  share,
  hasData = true,
  emptyLabel,
}: {
  filingType: FilingType;
  periodLabel: string;
  amount: number;
  /** The mark button's label, e.g. "Mark EMP201 as filed". */
  markLabel: string;
  /** The SARS/Labour caveat shown under the buttons. */
  note: React.ReactNode;
  filename: string;
  pdf: () => RenderPdfBody;
  fallbackHtml: (business: BusinessProfile, watermark: boolean) => string;
  share: () => void;
  /** False when the period has nothing to file — shows `emptyLabel` instead of the mark button. */
  hasData?: boolean;
  emptyLabel?: React.ReactNode;
}) {
  const { data: business } = useBusinessProfile();
  const { isTrialing, isReadOnly } = useTrialState();
  const watermark = isTrialing || isReadOnly;
  const { data: filings } = useTaxFilings();
  const markFiled = useMarkFiled();
  const unmarkFiled = useUnmarkFiled();

  const [busy, setBusy] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [undoError, setUndoError] = useState("");

  const currentFiling = (filings ?? []).find((f) => f.filing_type === filingType && f.period_label === periodLabel);

  const handlePrint = async () => {
    if (!business || busy) return;
    setBusy(true);
    try {
      const blob = await renderPdf(pdf());
      downloadBlob(blob, filename);
    } catch {
      // Chromium cold/absent/timed out — the print flow yields the same document.
      openDocumentForPrinting(fallbackHtml(business, watermark), filename);
    } finally {
      setBusy(false);
    }
  };

  const handleUnfile = () => {
    if (!currentFiling) return;
    setUndoError("");
    unmarkFiled.mutate(currentFiling.id, {
      onSuccess: () => setShowUndo(false),
      onError: (e) => setUndoError(e instanceof Error ? e.message : "Couldn't undo the filing."),
    });
  };

  const actionBtn: React.CSSProperties = {
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
    <>
      {currentFiling ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#0369A1" }}>
            ✅ Marked as filed for {periodLabel}
            {currentFiling.filed_date ? <span style={{ color: "#64748b" }}> · {currentFiling.filed_date}</span> : null}
          </div>
          {/* Made a mistake? Un-marking removes only this "filed" record — it never
              touched eFiling, so nothing else has to be reversed. */}
          <button
            onClick={() => setShowUndo((p) => !p)}
            style={{ width: "100%", marginTop: 8, background: "#fff1f2", border: "1.5px solid #fecdd3", borderRadius: 12, padding: "11px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#be123c" }}>↩️ Made a mistake? Undo this filing</span>
            <span style={{ color: "#be123c" }}>{showUndo ? "▲" : "▼"}</span>
          </button>
          {showUndo && (
            <div style={{ background: "#fff1f2", border: "1.5px solid #fecdd3", borderRadius: 12, padding: 14, marginTop: 8 }}>
              <div style={{ fontSize: 12, color: "#7f1d1d", lineHeight: 1.6, marginBottom: 10 }}>
                This removes the “filed” record for <strong>{periodLabel}</strong> so you can re-mark it once the numbers are right. It doesn&apos;t change anything you submitted on the SARS or Labour portals — that stays as it is.
              </div>
              {undoError && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 10 }}>{undoError}</p>}
              <button
                onClick={handleUnfile}
                disabled={unmarkFiled.isPending}
                style={{ width: "100%", background: "#be123c", color: "#fff", border: "none", borderRadius: 12, padding: 13, fontSize: 13, fontWeight: 700, cursor: unmarkFiled.isPending ? "default" : "pointer", opacity: unmarkFiled.isPending ? 0.6 : 1 }}
              >
                {unmarkFiled.isPending ? "Undoing..." : "Confirm — undo this filing"}
              </button>
            </div>
          )}
        </div>
      ) : hasData ? (
        <button
          onClick={() => markFiled.mutate({ filing_type: filingType, period_label: periodLabel, amount })}
          disabled={markFiled.isPending}
          style={{ width: "100%", background: "#0369A1", border: "none", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 700, color: "#fff", cursor: markFiled.isPending ? "default" : "pointer", marginBottom: 14 }}
        >
          {markFiled.isPending ? "Saving..." : `✔️ ${markLabel}`}
        </button>
      ) : (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 14, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
          {emptyLabel ?? "Nothing to file for this period."}
        </div>
      )}

      {note && (
        <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#92400e", lineHeight: 1.6, marginBottom: 14 }}>
          {note}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <button onClick={handlePrint} disabled={!business || busy} style={actionBtn}>
          {busy ? "📄 Preparing..." : "📄 Download PDF"}
        </button>
        <button onClick={share} style={actionBtn}>
          📤 Share
        </button>
      </div>
    </>
  );
}

/** The filing-history list every return screen shows below its actions. */
export function FilingHistory({ filingType, filings }: { filingType: FilingType; filings: { id: string; filing_type: string; period_label: string; amount: number; filed_date: string }[] }) {
  const rows = filings.filter((f) => f.filing_type === filingType);
  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Filing history</div>
      {rows.map((f) => (
        <div key={f.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{f.period_label}</span>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {fmt(f.amount)} · filed {f.filed_date}
          </span>
        </div>
      ))}
    </div>
  );
}
