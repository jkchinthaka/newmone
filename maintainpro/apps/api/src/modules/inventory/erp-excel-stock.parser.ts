import ExcelJS from "exceljs";

import { normalizeErpItemCode } from "./erp-stock-sync.mapper";

export const ERP_EXCEL_MAX_BYTES = 10 * 1024 * 1024;

export const ITEM_CODE_ALIASES = [
  "item code",
  "itemcode",
  "item no",
  "item number",
  "product code",
  "part number",
  "part no",
  "partnumber",
  "stock code",
  "sku",
  "erp item code",
  "material code"
] as const;

export const QUANTITY_ALIASES = [
  "qty",
  "quantity",
  "balance qty",
  "balance quantity",
  "current stock",
  "available qty",
  "available quantity",
  "stock balance",
  "on hand",
  "quantity on hand",
  "qty on hand"
] as const;

export const NAME_ALIASES = ["item name", "product name", "description", "part name", "name"] as const;

export const WAREHOUSE_ALIASES = [
  "warehouse",
  "warehouse code",
  "wh",
  "location",
  "store",
  "site"
] as const;

export const UOM_ALIASES = ["uom", "unit", "unit of measure"] as const;

export const BUSINESS_DATE_ALIASES = [
  "business date",
  "as of",
  "as of date",
  "stock date",
  "balance date",
  "date"
] as const;

export type ErpExcelColumnMapping = {
  itemCode: string;
  quantity: string;
  itemName?: string | null;
  warehouse?: string | null;
  uom?: string | null;
  businessDate?: string | null;
};

export type ErpExcelParsedRow = {
  rowNumber: number;
  itemCode: string | null;
  itemName: string | null;
  quantityRaw: unknown;
  quantity: number | null;
  warehouseCode: string | null;
  uom: string | null;
  businessDate: string | null;
  invalidReason: string | null;
};

export type ErpExcelStagingRecord = {
  rowNumber: number;
  values: Record<string, unknown>;
};

export type ErpExcelWorkbookInsight = {
  sheetNames: string[];
  selectedSheet: string;
  headerRowIndex: number;
  headers: string[];
  suggestedMapping: Partial<ErpExcelColumnMapping>;
  mappingConfidence: "high" | "low";
  warehousesDetected: string[];
  rows: ErpExcelParsedRow[];
  stagingRecords: ErpExcelStagingRecord[];
  /** Per-sheet staging so validate can switch sheets without re-uploading the file. */
  sheetsByName: Record<string, ErpExcelSheetStaging>;
};

export type ErpExcelSheetStaging = {
  headers: string[];
  headerRowIndex: number;
  suggestedMapping: Partial<ErpExcelColumnMapping>;
  mappingConfidence: "high" | "low";
  warehousesDetected: string[];
  records: ErpExcelStagingRecord[];
};

export const ERP_EXCEL_MULTI_STAGING_FORMAT = "erp-excel-multi-v1" as const;

export type ErpExcelMultiSheetStaging = {
  format: typeof ERP_EXCEL_MULTI_STAGING_FORMAT;
  activeSheet: string;
  sheets: Record<string, ErpExcelSheetStaging>;
};

export function isMultiSheetStaging(value: unknown): value is ErpExcelMultiSheetStaging {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as ErpExcelMultiSheetStaging).format === ERP_EXCEL_MULTI_STAGING_FORMAT &&
    typeof (value as ErpExcelMultiSheetStaging).sheets === "object"
  );
}

export function resolveSheetStaging(
  staging: unknown,
  sheetName?: string | null
): { sheetName: string; staging: ErpExcelSheetStaging | { records: ErpExcelStagingRecord[]; headers?: string[] } } {
  if (isMultiSheetStaging(staging)) {
    const preferred =
      sheetName && staging.sheets[sheetName]
        ? sheetName
        : staging.activeSheet in staging.sheets
          ? staging.activeSheet
          : Object.keys(staging.sheets)[0];
    if (!preferred || !staging.sheets[preferred]) {
      const err = new Error("IMPORT_NOT_READY");
      (err as Error & { code: string }).code = "IMPORT_NOT_READY";
      throw err;
    }
    return { sheetName: preferred, staging: staging.sheets[preferred] };
  }
  if (Array.isArray(staging)) {
    return {
      sheetName: sheetName ?? "",
      staging: { records: staging as ErpExcelStagingRecord[] }
    };
  }
  const err = new Error("IMPORT_NOT_READY");
  (err as Error & { code: string }).code = "IMPORT_NOT_READY";
  throw err;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function cellToPlain(value: ExcelJS.CellValue): unknown {
  if (value == null) return null;
  if (typeof value === "object" && "text" in (value as object)) {
    return (value as { text?: string }).text ?? null;
  }
  if (typeof value === "object" && "result" in (value as object)) {
    return (value as { result?: unknown }).result ?? null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value;
}

function matchAlias(header: string, aliases: readonly string[]): boolean {
  const normalized = normalizeHeader(header).replace(/[._-]/g, " ");
  return aliases.some((alias) => normalized === alias);
}

function suggestField(headers: string[], aliases: readonly string[]): string | undefined {
  return headers.find((header) => matchAlias(header, aliases));
}

function parseQuantity(raw: unknown): { quantity: number | null; invalidReason: string | null } {
  if (raw == null || raw === "") {
    return { quantity: null, invalidReason: "Quantity is required" };
  }
  const asNumber = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(asNumber)) {
    return { quantity: null, invalidReason: "Quantity is not a number" };
  }
  if (asNumber < 0) {
    return { quantity: null, invalidReason: "Negative quantity is not allowed" };
  }
  if (!Number.isInteger(asNumber)) {
    return { quantity: null, invalidReason: "Quantity must be a whole number" };
  }
  return { quantity: asNumber, invalidReason: null };
}

export function assertXlsxUpload(file: {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}) {
  const name = String(file.originalname ?? "").toLowerCase();
  if (!name.endsWith(".xlsx")) {
    const err = new Error(
      name.endsWith(".xls") || name.endsWith(".xlsm") || name.endsWith(".csv")
        ? "UNSUPPORTED_WORKBOOK"
        : "INVALID_FILE"
    );
    (err as Error & { code: string }).code = (err as Error).message;
    throw err;
  }
  if ((file.size ?? file.buffer?.length ?? 0) > ERP_EXCEL_MAX_BYTES) {
    const err = new Error("INVALID_FILE");
    (err as Error & { code: string }).code = "INVALID_FILE";
    throw err;
  }
  if (!file.buffer || file.buffer.length === 0) {
    const err = new Error("INVALID_FILE");
    (err as Error & { code: string }).code = "INVALID_FILE";
    throw err;
  }
  // OOXML .xlsx is a ZIP package (PK\x03\x04). Reject renamed non-zip payloads early.
  const magic = file.buffer.subarray(0, 4);
  const isZip =
    magic.length >= 4 &&
    magic[0] === 0x50 &&
    magic[1] === 0x4b &&
    (magic[2] === 0x03 || magic[2] === 0x05 || magic[2] === 0x07) &&
    (magic[3] === 0x04 || magic[3] === 0x06 || magic[3] === 0x08);
  if (!isZip) {
    const err = new Error("UNSUPPORTED_WORKBOOK");
    (err as Error & { code: string }).code = "UNSUPPORTED_WORKBOOK";
    throw err;
  }
}

function buildRowsFromRecords(
  stagingRecords: ErpExcelStagingRecord[],
  mapping: Partial<ErpExcelColumnMapping>
): { rows: ErpExcelParsedRow[]; warehousesDetected: string[] } {
  const warehouses = new Set<string>();
  const rows: ErpExcelParsedRow[] = [];
  const mappingReady = Boolean(mapping.itemCode && mapping.quantity);

  for (const record of stagingRecords) {
    const itemCodeRaw = mapping.itemCode ? record.values[mapping.itemCode] : undefined;
    const quantityRaw = mapping.quantity ? record.values[mapping.quantity] : undefined;
    const itemNameRaw = mapping.itemName ? record.values[mapping.itemName] : null;
    const warehouseRaw = mapping.warehouse ? record.values[mapping.warehouse] : null;
    const uomRaw = mapping.uom ? record.values[mapping.uom] : null;
    const businessDateRaw = mapping.businessDate ? record.values[mapping.businessDate] : null;

    const itemCode = itemCodeRaw == null || itemCodeRaw === "" ? null : String(itemCodeRaw).trim();
    if (!itemCode && (quantityRaw == null || quantityRaw === "")) {
      continue;
    }

    let invalidReason: string | null = null;
    if (!mappingReady) {
      invalidReason = "Column mapping required";
    } else if (!itemCode) {
      invalidReason = "Item code is required";
    }

    const qtyParsed = parseQuantity(quantityRaw);
    if (!invalidReason && qtyParsed.invalidReason) {
      invalidReason = qtyParsed.invalidReason;
    }

    const warehouseCode = warehouseRaw != null ? String(warehouseRaw).trim() || null : null;
    if (warehouseCode) warehouses.add(warehouseCode);

    rows.push({
      rowNumber: record.rowNumber,
      itemCode: itemCode ? normalizeErpItemCode(itemCode) : null,
      itemName: itemNameRaw != null ? String(itemNameRaw).trim() : null,
      quantityRaw,
      quantity: qtyParsed.quantity,
      warehouseCode,
      uom: uomRaw != null ? String(uomRaw).trim() || null : null,
      businessDate: businessDateRaw != null ? String(businessDateRaw).trim() || null : null,
      invalidReason
    });
  }

  return { rows, warehousesDetected: Array.from(warehouses).sort() };
}

export async function inspectErpExcelWorkbook(
  buffer: Buffer,
  options?: { sheetName?: string; mapping?: Partial<ErpExcelColumnMapping> }
): Promise<ErpExcelWorkbookInsight> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    const err = new Error("UNSUPPORTED_WORKBOOK");
    (err as Error & { code: string }).code = "UNSUPPORTED_WORKBOOK";
    throw err;
  }

  const sheetNames = workbook.worksheets.map((sheet) => sheet.name).filter(Boolean);
  if (sheetNames.length === 0) {
    const err = new Error("UNSUPPORTED_WORKBOOK");
    (err as Error & { code: string }).code = "UNSUPPORTED_WORKBOOK";
    throw err;
  }

  const sheetsByName: Record<string, ErpExcelSheetStaging> = {};
  for (const name of sheetNames) {
    try {
      sheetsByName[name] = inspectWorksheet(workbook, name, options?.mapping);
    } catch {
      // Skip sheets that lack detectable headers; keep workbook usable if others succeed.
    }
  }
  if (Object.keys(sheetsByName).length === 0) {
    const err = new Error("INVALID_HEADERS");
    (err as Error & { code: string }).code = "INVALID_HEADERS";
    throw err;
  }

  const usableNames = Object.keys(sheetsByName);
  const selectedSheet =
    options?.sheetName && sheetsByName[options.sheetName]
      ? options.sheetName
      : usableNames.includes(sheetNames[0])
        ? sheetNames[0]
        : usableNames[0];
  const selected = sheetsByName[selectedSheet];
  const materialized = buildRowsFromRecords(selected.records, selected.suggestedMapping);

  return {
    sheetNames,
    selectedSheet,
    headerRowIndex: selected.headerRowIndex,
    headers: selected.headers,
    suggestedMapping: selected.suggestedMapping,
    mappingConfidence: selected.mappingConfidence,
    warehousesDetected: selected.warehousesDetected,
    rows: materialized.rows,
    stagingRecords: selected.records,
    sheetsByName
  };
}

function inspectWorksheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  mappingOverride?: Partial<ErpExcelColumnMapping>
): ErpExcelSheetStaging {
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    const err = new Error("UNSUPPORTED_WORKBOOK");
    (err as Error & { code: string }).code = "UNSUPPORTED_WORKBOOK";
    throw err;
  }

  let headerRowIndex = 1;
  const headerByCol = new Map<number, string>();
  for (let rowNumber = 1; rowNumber <= Math.min(worksheet.rowCount || 1, 30); rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const seen = new Set<string>();
    const provisional = new Map<number, string>();
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const label = String(cellToPlain(cell.value) ?? "").trim();
      if (!label) return;
      let unique = label;
      let suffix = 2;
      while (seen.has(normalizeHeader(unique))) {
        unique = `${label}_${suffix}`;
        suffix += 1;
      }
      seen.add(normalizeHeader(unique));
      provisional.set(colNumber, unique);
    });
    if (provisional.size >= 2) {
      headerRowIndex = rowNumber;
      provisional.forEach((value, key) => headerByCol.set(key, value));
      break;
    }
  }

  const headers = Array.from(headerByCol.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, name]) => name);

  if (headers.length < 2) {
    const err = new Error("INVALID_HEADERS");
    (err as Error & { code: string }).code = "INVALID_HEADERS";
    throw err;
  }

  const suggestedMapping: Partial<ErpExcelColumnMapping> = {
    itemCode: mappingOverride?.itemCode ?? suggestField(headers, ITEM_CODE_ALIASES),
    quantity: mappingOverride?.quantity ?? suggestField(headers, QUANTITY_ALIASES),
    itemName: mappingOverride?.itemName ?? suggestField(headers, NAME_ALIASES) ?? null,
    warehouse: mappingOverride?.warehouse ?? suggestField(headers, WAREHOUSE_ALIASES) ?? null,
    uom: mappingOverride?.uom ?? suggestField(headers, UOM_ALIASES) ?? null,
    businessDate: mappingOverride?.businessDate ?? suggestField(headers, BUSINESS_DATE_ALIASES) ?? null
  };

  const mappingConfidence =
    suggestedMapping.itemCode && suggestedMapping.quantity ? "high" : "low";

  const records: ErpExcelStagingRecord[] = [];
  for (let rowNumber = headerRowIndex + 1; rowNumber <= (worksheet.rowCount || headerRowIndex); rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values: Record<string, unknown> = {};
    let anyValue = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = headerByCol.get(colNumber);
      if (!header) return;
      values[header] = cellToPlain(cell.value);
      anyValue = true;
    });
    if (!anyValue) continue;
    records.push({ rowNumber, values });
  }

  const materialized = buildRowsFromRecords(records, suggestedMapping);
  return {
    headers,
    headerRowIndex,
    suggestedMapping,
    mappingConfidence,
    warehousesDetected: materialized.warehousesDetected,
    records
  };
}

export function materializeRowsFromStaging(
  stagingRecords: ErpExcelStagingRecord[],
  mapping: ErpExcelColumnMapping
): { rows: ErpExcelParsedRow[]; warehousesDetected: string[] } {
  return buildRowsFromRecords(stagingRecords, mapping);
}

export function mappingIsComplete(
  mapping: Partial<ErpExcelColumnMapping> | null | undefined
): mapping is ErpExcelColumnMapping {
  return Boolean(mapping?.itemCode && mapping?.quantity);
}
