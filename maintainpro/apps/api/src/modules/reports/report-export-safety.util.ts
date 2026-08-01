const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function neutralizeSpreadsheetValue(value: unknown): string {
  const raw = value == null ? "" : String(value);
  if (FORMULA_PREFIX.test(raw)) {
    return `'${raw}`;
  }
  return raw;
}

export function csvEscapeCell(value: unknown): string {
  const safe = neutralizeSpreadsheetValue(value).replaceAll('"', '""');
  return `"${safe}"`;
}

export function safeExportFilename(moduleKey: string, extension: "csv" | "xlsx" | "pdf"): string {
  const allowed = moduleKey.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "report";
  const day = new Date().toISOString().slice(0, 10);
  return `${allowed}-report-${day}.${extension}`;
}

export function contentDispositionAttachment(filename: string): string {
  const safe = filename.replace(/["\r\n]/g, "_");
  return `attachment; filename="${safe}"`;
}
