"use client";

import { useState } from "react";
import { buildDocumentHTML, type DocForRender, type DocKind } from "@/lib/docgen/buildDocumentHTML";
import { openDocumentForPrinting, shareDocumentText, archiveGeneratedDocument } from "@/lib/docgen/shareDocument";
import { renderPdf, downloadBlob } from "@/lib/docgen/renderPdf";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";
import { useSubscription, useTrialState } from "@/lib/supabase/hooks/useSubscription";

export function DocumentActions({
  doc,
  kind,
  sourceId,
  shareText,
}: {
  doc: DocForRender;
  kind: DocKind;
  sourceId: string;
  shareText: string;
}) {
  const { data: business } = useBusinessProfile();
  // The client-render fallback (when the server PDF route is unavailable) and the
  // archived copy both carry the same trial watermark the server would apply. The
  // server PDF route is authoritative (it recomputes from the DB); this only feeds
  // the fallback + archive. Watermark whenever we can't PROVE the business has
  // paid — trialing, read-only, OR the subscription query errored (status unknown)
  // — so an unresolved paid state can't leak a clean document. While the status is
  // still loading, the buttons stay disabled rather than acting on a false default.
  const { isTrialing, isReadOnly, loading } = useTrialState();
  const { isError } = useSubscription();
  const watermark = isTrialing || isReadOnly || isError;
  const [busy, setBusy] = useState(false);

  const handlePrint = async () => {
    if (!business) return;
    setBusy(true);
    try {
      const html = buildDocumentHTML(doc, business, kind, watermark);
      try {
        const blob = await renderPdf({ kind, doc });
        downloadBlob(blob, `${kind}-${doc.doc_number}`);
      } catch {
        // Chromium can be cold, absent locally, or time out. The print flow
        // already yields a correct document, so fall back rather than fail.
        openDocumentForPrinting(html, `${kind}-${doc.doc_number}`);
      }
      // Archive is best-effort record-keeping; never block the flow on it.
      await archiveGeneratedDocument(html, kind, sourceId).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      await shareDocumentText(`Worklog — ${doc.doc_number}`, shareText);
      if (business) {
        const html = buildDocumentHTML(doc, business, kind, watermark);
        await archiveGeneratedDocument(html, kind, sourceId).catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
      <button
        onClick={handlePrint}
        disabled={busy || !business || loading}
        style={{
          flex: 1,
          background: "#F0F9FF",
          color: "#0C4A6E",
          border: "1.5px solid #BAE6FD",
          borderRadius: 12,
          padding: 13,
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {busy ? "📄 Preparing PDF..." : "📄 Download PDF"}
      </button>
      <button
        onClick={handleShare}
        disabled={busy || loading}
        style={{
          flex: 1,
          background: "#F0F9FF",
          color: "#0C4A6E",
          border: "1.5px solid #BAE6FD",
          borderRadius: 12,
          padding: 13,
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        📤 Share
      </button>
    </div>
  );
}
