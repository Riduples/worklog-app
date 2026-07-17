/**
 * Escapes a value for interpolation into generated document HTML.
 *
 * Every value the document builders interpolate is somebody's free text — a
 * business name, a client name, a bank reference, a payment note.
 * openDocumentForPrinting() hands the finished markup to win.document.write(),
 * which executes scripts, so an unescaped name containing markup would run: a
 * member with edit rights on Contacts could store a payload that fires when the
 * owner prints an invoice or a statement, in a same-origin window that can read
 * the session. Escaping at the boundary is the fix; no builder should ever
 * interpolate raw.
 *
 * Shared rather than per-builder because it was previously defined inside
 * buildDocumentHTML only, and buildLedgerHTML — the other builder, feeding the
 * same document.write() — went unescaped entirely as a result.
 */
export function esc(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
