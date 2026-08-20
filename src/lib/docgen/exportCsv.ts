// Client-side CSV export — the mirror of the CSV import/template flow. A report
// hands over its headers and rows and gets a spreadsheet file, the same way the
// importer hands out a template. Numbers stay unformatted (no "R", no thousands
// separators) so the file opens as data a spreadsheet can add up, not text.

export type CsvCell = string | number | null | undefined;

// A spreadsheet treats a cell opening with = + - @ (or a leading tab/CR) as a
// formula, so a contact called "=cmd|' /c calc'!A1" becomes executable content
// the moment someone opens the export. The cell is neutralised with a leading
// apostrophe, which Excel and LibreOffice both consume as "this is text".
//
// Numbers are exempt, and that exemption is the whole difficulty: a negative
// total legitimately opens with "-", and quoting -1500.00 as text would break
// the column this file exists to let a spreadsheet add up. So the test is "does
// this parse as a number", not "does it start with a dangerous character" —
// -1500.00 passes through untouched, -1500=SUM(A1) does not.
const RISKY_LEAD = /^[=+\-@\t\r]/;
const NUMERIC = /^-?\d+(\.\d+)?$/;

function neutralise(s: string): string {
  return RISKY_LEAD.test(s) && !NUMERIC.test(s) ? `'${s}` : s;
}

// RFC 4180 quoting: wrap a field in quotes when it holds a comma, quote, or
// newline, and double any quotes inside it. Everything else passes through, so a
// plain "120.00" or "Acme Ltd" stays readable in the raw file.
function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  // A number from the caller is a number — it can't carry a payload, and running
  // it through the text guard would be the one way to break the sums.
  const s = typeof cell === "number" ? String(cell) : neutralise(String(cell));
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
