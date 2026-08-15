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
};

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
  if (!name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".xlsm") || name.endsWith(".csv")) {
    // .xls endsWith .xlsx is false; .xlsx check first
  }
  if (!name.endsWith(".xlsx")) {
    const err = new Error(name.endsWith(".xls") || name.endsWith(".xlsm") || name.endsWith(".csv")
      ? "UNSUPPORTED_WORKBOOK"
      : "INVALID_FILE");
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

  const selectedSheet =
    options?.sheetName && sheetNames.includes(options.sheetName) ? options.sheetName : sheetNames[0];
  const worksheet = workbook.getWorksheet(selectedSheet);
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
    itemCode: options?.mapping?.itemCode ?? suggestField(headers, ITEM_CODE_ALIASES),
    quantity: options?.mapping?.quantity ?? suggestField(headers, QUANTITY_ALIASES),
    itemName: options?.mapping?.itemName ?? suggestField(headers, NAME_ALIASES) ?? null,
    warehouse: options?.mapping?.warehouse ?? suggestField(headers, WAREHOUSE_ALIASES) ?? null,
    uom: options?.mapping?.uom ?? suggestField(headers, UOM_ALIASES) ?? null,
    businessDate: options?.mapping?.businessDate ?? suggestField(headers, BUSINESS_DATE_ALIASES) ?? null
  };

  const mappingConfidence =
    suggestedMapping.itemCode && suggestedMapping.quantity ? "high" : "low";

  const stagingRecords: ErpExcelStagingRecord[] = [];
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
    stagingRecords.push({ rowNumber, values });
  }

  const materialized = buildRowsFromRecords(stagingRecords, suggestedMapping);

  return {
    sheetNames,
    selectedSheet,
    headerRowIndex,
    headers,
    suggestedMapping,
    mappingConfidence,
    warehousesDetected: materialized.warehousesDetected,
    rows: materialized.rows,
    stagingRecords
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
