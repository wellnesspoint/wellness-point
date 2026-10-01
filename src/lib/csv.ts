/**
 * CSV helpers. Cells are quoted/escaped per RFC 4180, and text that starts
 * with a spreadsheet formula character (= + - @ tab CR) is prefixed with a
 * single quote so customer-controlled values (names, addresses…) can't run as
 * formulas when the file is opened in Excel/Sheets (CSV injection).
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Browser-only: build the CSV and trigger a download. */
export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  // BOM so Excel reads UTF-8 (₹, accented names) correctly.
  const blob = new Blob(["﻿", toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
