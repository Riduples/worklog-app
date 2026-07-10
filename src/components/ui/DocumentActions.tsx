"use client";

import { useState } from "react";
import { buildDocumentHTML, type DocForRender, type DocKind } from "@/lib/docgen/buildDocumentHTML";
import { openDocumentForPrinting, shareDocumentText, archiveGeneratedDocument } from "@/lib/docgen/shareDocument";
import { useBusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";

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
  const [busy, setBusy] = useState(false);

  const handlePrint = async () => {
    if (!business) return;
    setBusy(true);
    try {
      const html = buildDocumentHTML(doc, business, kind);
      openDocumentForPrinting(html, `${kind}-${doc.doc_number}`);
      // Archive is best-effort record-keeping; never block the print flow on it.
      await archiveGeneratedDocument(html, kind, sourceId).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      await shareDocumentText(`WORKLOG — ${doc.doc_number}`, shareText);
      if (business) {
        const html = buildDocumentHTML(doc, business, kind);
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
        disabled={busy || !business}
        style={{
          flex: 1,
          background: "#f0fdf4",
          color: "#1B4332",
          border: "1.5px solid #d1fae5",
          borderRadius: 12,
          padding: 13,
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        🖨️ Save as PDF / Print
      </button>
      <button
        onClick={handleShare}
        disabled={busy}
        style={{
          flex: 1,
          background: "#f0fdf4",
          color: "#1B4332",
          border: "1.5px solid #d1fae5",
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
