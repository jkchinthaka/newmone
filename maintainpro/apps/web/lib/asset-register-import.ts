import * as XLSX from "xlsx";

import { apiClient } from "@/lib/api-client";

/** Add many assets from Excel (whole-company asset register). Same rules as the API. */
export const ASSET_IMPORT_MAX_ROWS = 2000;
export const ASSET_IMPORT_SAVE_CHUNK = 200;

export type AssetImportKey =
  | "assetGroup"
  | "category"
  | "type"
  | "name"
  | "site"
  | "functionalLocation"
  | "department"
  | "assetTag"
  | "serialNumber"
  | "manufacturer"
  | "model"
  | "criticality"
  | "status"
  | "parentAssetTag"
  | "fixedAssetCode"
  | "purchaseDate"
  | "purchasePrice"
  | "warrantyExpiry"
  | "supplier"
  | "responsiblePerson"
  | "notes";

export type AssetImportRow = Partial<Record<AssetImportKey, string>> & { row: number; autoTag?: boolean };

export type AssetImportLine = {
  row: number;
  status: "NEW" | "UPDATE" | "SKIP" | "ERROR";
  messages: string[];
  warnings: string[];
  assetTag: string;
  autoTag: boolean;
  name: string;
  display: {
    assetGroup: string;
    category: string;
    type: string;
    site: string;
    functionalLocation: string;
    department: string;
    responsiblePerson: string;
    parentAssetTag: string;
  };
  existingAssetId?: string;
  existingAssetTag?: string;
  parentRowTag?: string;
};

export type AssetImportPreview = {
  lines: AssetImportLine[];
  counts: { total: number; new: number; update: number; skip: number; error: number };
};

export type AssetImportSaveResult = {
  row: number;
  status: "CREATED" | "UPDATED" | "SKIPPED" | "ERROR";
  assetId?: string;
  assetTag: string;
  name: string;
  message?: string;
};

/** Header text (any case, spaces or punctuation) → column. Accepts common names from older registers. */
const HEADER_ALIASES: Record<AssetImportKey, string[]> = {
  assetGroup: ["asset group", "group", "asset domain", "domain"],
  category: ["category", "asset category"],
  type: ["type", "asset type"],
  name: ["name", "asset name", "machine name", "equipment name", "item name", "asset description"],
  site: ["site", "site name", "site code", "plant", "branch"],
  functionalLocation: ["functional location", "location", "location code", "area", "building", "building area"],
  department: ["department", "dept", "owner department"],
  assetTag: ["asset tag", "tag", "qr tag", "asset tag no"],
  serialNumber: ["serial number", "serial", "serial no", "s n", "sn"],
  manufacturer: ["manufacturer", "make", "brand"],
  model: ["model", "model no"],
  criticality: ["criticality", "importance", "how important"],
  status: ["status"],
  parentAssetTag: ["parent asset tag", "parent tag", "parent asset", "part of"],
  fixedAssetCode: ["erp fixed asset code", "fixed asset code", "erp code", "asset code", "far code", "fa code"],
  purchaseDate: ["purchase date", "bought on", "date of purchase"],
  purchasePrice: ["purchase price", "cost", "purchase cost", "price"],
  warrantyExpiry: ["warranty expiry", "warranty ends", "warranty end", "warranty end date"],
  supplier: ["supplier", "vendor"],
  responsiblePerson: ["responsible person", "responsible person email", "owner email", "responsible"],
  notes: ["notes", "remarks", "description", "comments"]
};

export const REQUIRED_IMPORT_COLUMNS: Array<{ key: AssetImportKey; label: string }> = [
  { key: "assetGroup", label: "Asset group" },
  { key: "category", label: "Category" },
  { key: "name", label: "Name" },
  { key: "site", label: "Site" }
];

function headerKey(header: unknown): AssetImportKey | null {
  const clean = String(header ?? "")
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!clean) return null;
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<[AssetImportKey, string[]]>) {
    if (aliases.includes(clean)) return key;
  }
  return null;
}

/** Excel dates come as Date objects; keep them as YYYY-MM-DD (no time zone shift). */
function cellText(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const shifted = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
    return shifted.toISOString().slice(0, 10);
  }
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

const DATE_KEYS = new Set<AssetImportKey>(["purchaseDate", "warrantyExpiry"]);

/** Excel stores dates as day numbers; read the calendar date without any time zone shift. */
function excelSerialDate(serial: number): string {
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed || !parsed.y) return String(serial);
  return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
}

/**
 * Sheet rows (header first) → import rows. Picks the sheet called "Assets" when there is one.
 * Blank rows are skipped; `row` is the Excel row number so messages point at the right line.
 */
export function assetRowsFromSheet(rows: unknown[][]): { rows: AssetImportRow[]; missingColumns: string[]; unknownColumns: string[] } {
  const headerIndex = rows.findIndex((row) => row.some((cell) => headerKey(cell)));
  if (headerIndex < 0) return { rows: [], missingColumns: REQUIRED_IMPORT_COLUMNS.map((column) => column.label), unknownColumns: [] };
  const header = rows[headerIndex];
  const columns = header.map((cell) => headerKey(cell));
  const unknownColumns = header
    .map((cell, index) => (columns[index] ? null : cellText(cell)))
    .filter((value): value is string => Boolean(value));
  const missingColumns = REQUIRED_IMPORT_COLUMNS.filter((column) => !columns.includes(column.key)).map((column) => column.label);
  const out: AssetImportRow[] = [];
  rows.slice(headerIndex + 1).forEach((cells, offset) => {
    const row: AssetImportRow = { row: headerIndex + offset + 2 };
    let filled = false;
    columns.forEach((key, index) => {
      if (!key) return;
      const raw = cells[index];
      const value = DATE_KEYS.has(key) && typeof raw === "number" ? excelSerialDate(raw) : cellText(raw);
      if (value) {
        row[key] = value;
        filled = true;
      }
    });
    if (filled) out.push(row);
  });
  return { rows: out, missingColumns, unknownColumns };
}

export async function readAssetWorkbook(file: File) {
  // Dates stay Excel day numbers (cellDates off) so no time zone can move them a day.
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const name = workbook.SheetNames.find((sheet) => sheet.trim().toLowerCase() === "assets") ?? workbook.SheetNames[0];
  const sheet = name ? workbook.Sheets[name] : undefined;
  if (!sheet) return { rows: [], missingColumns: REQUIRED_IMPORT_COLUMNS.map((column) => column.label), unknownColumns: [] };
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
  return assetRowsFromSheet(rows);
}

/** Rows go up as a small JSON file (2,000 assets is larger than a normal JSON request). */
function rowsForm(rows: AssetImportRow[], updateExisting: boolean) {
  const form = new FormData();
  form.append("rows", new Blob([JSON.stringify(rows)], { type: "application/json" }), "rows.json");
  form.append("updateExisting", String(updateExisting));
  return form;
}

export async function previewAssetImport(rows: AssetImportRow[], updateExisting: boolean): Promise<AssetImportPreview> {
  const response = await apiClient.post("/admin/asset-register/preview", rowsForm(rows, updateExisting), { timeout: 120_000 });
  return response.data?.data as AssetImportPreview;
}

export async function saveAssetImportChunk(rows: AssetImportRow[], updateExisting: boolean) {
  const response = await apiClient.post("/admin/asset-register/save", rowsForm(rows, updateExisting), { timeout: 300_000 });
  return response.data?.data as { results: AssetImportSaveResult[]; counts: { created: number; updated: number; skipped: number; errors: number } };
}

export async function downloadAssetImportTemplate() {
  const response = await apiClient.get("/admin/asset-register/template.xlsx", { responseType: "blob" });
  const url = URL.createObjectURL(response.data as Blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "asset-register-template.xlsx";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * What is sent to save: the file rows, with the tag shown in the preview (system-numbered tags
 * are marked so a retry or a taken number is handled by the server).
 */
export function rowsToSave(rows: AssetImportRow[], lines: AssetImportLine[], tagEdits: Record<number, string>): AssetImportRow[] {
  const byRow = new Map(lines.map((line) => [line.row, line]));
  return rows
    .filter((row) => {
      const line = byRow.get(row.row);
      return line && (line.status === "NEW" || line.status === "UPDATE");
    })
    .map((row) => {
      const line = byRow.get(row.row)!;
      const edited = tagEdits[row.row];
      if (edited !== undefined) return { ...row, assetTag: edited.trim().toUpperCase(), autoTag: false };
      if (line.autoTag && line.assetTag) return { ...row, assetTag: line.assetTag, autoTag: true };
      return row;
    });
}

/** Parents saved before children: a row whose parent is a new row of the file goes after it. */
export function chunkForSave(rows: AssetImportRow[], lines: AssetImportLine[], size = ASSET_IMPORT_SAVE_CHUNK): AssetImportRow[][] {
  const byRow = new Map(lines.map((line) => [line.row, line]));
  const rowByTag = new Map(lines.filter((line) => line.assetTag).map((line) => [line.assetTag.toUpperCase(), line.row]));
  const depth = (row: number, seen = new Set<number>()): number => {
    const parentTag = byRow.get(row)?.parentRowTag;
    const parentRow = parentTag ? rowByTag.get(parentTag) : undefined;
    if (!parentRow || seen.has(parentRow)) return 0;
    seen.add(parentRow);
    return 1 + depth(parentRow, seen);
  };
  const ordered = [...rows].sort((left, right) => depth(left.row) - depth(right.row) || left.row - right.row);
  const chunks: AssetImportRow[][] = [];
  for (let index = 0; index < ordered.length; index += size) chunks.push(ordered.slice(index, index + size));
  return chunks;
}

export function lineProblems(line: AssetImportLine): string {
  return [...line.messages, ...line.warnings].join(" ");
}

/** Rows that could not be saved, as a CSV to fix and upload again. */
export function importErrorsCsv(entries: Array<{ row: number; assetTag: string; name: string; message: string }>): string {
  const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return ["Row,Asset tag,Name,Problem", ...entries.map((entry) => [entry.row, entry.assetTag, entry.name, entry.message].map(quote).join(","))].join("\n");
}

export const LABEL_IDS_STORAGE_KEY = "maintainpro.assetLabelIds";
