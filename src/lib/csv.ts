// Minimal CSV serialiser + download trigger.
//
// RFC 4180 quoting: wrap in double quotes when the cell holds a comma, quote,
// CR or LF, and double any embedded quote. Excel needs CRLF line endings to
// parse multi-line cells correctly, so that's what we emit.

export type CsvCell = string | number | boolean | null | undefined;

const cell = (v: CsvCell): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /["',\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export const toCsv = (rows: CsvCell[][]): string =>
  rows.map((row) => row.map(cell).join(",")).join("\r\n");

// Prefixed with a UTF-8 BOM so Excel on Windows reads Arabic charger names as
// UTF-8 instead of falling back to the system code page.
export const downloadCsv = (filename: string, rows: CsvCell[][]): void => {
  const blob = new Blob(["﻿", toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// `charj-chargers-2026-09-20.csv`
export const stampedFilename = (stem: string): string =>
  `charj-${stem}-${new Date().toISOString().slice(0, 10)}.csv`;
