// Client-side CSV export — the mirror of the CSV import/template flow. A report
// hands over its headers and rows and gets a spreadsheet file, the same way the
// importer hands out a template. Numbers stay unformatted (no "R", no thousands
// separators) so the file opens as data a spreadsheet can add up, not text.

export type CsvCell = string | number | null | undefined;

// RFC 4180 quoting: wrap a field in quotes when it holds a comma, quote, or
// newline, and double any quotes inside it. Everything else passes through, so a
// plain "120.00" or "Acme Ltd" stays readable in the raw file.
function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  const s = String(cell);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  // A leading BOM so Excel reads the file as UTF-8 — without it, accented names
  // and the rand sign come out mangled on Windows.
  return "﻿" + lines.join("\r\n");
}

export function downloadCsv(csv: string, filename: string) {
  const name = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type CsvExport = { filename: string; headers: string[]; rows: CsvCell[][] };

// One place that turns a report's CsvExport into a downloaded file, shared by the
// Export CSV button wherever it appears.
export function exportCsv({ filename, headers, rows }: CsvExport) {
  downloadCsv(buildCsv(headers, rows), filename);
}
