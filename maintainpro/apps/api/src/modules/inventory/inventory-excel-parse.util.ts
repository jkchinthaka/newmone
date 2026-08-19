import ExcelJS from "exceljs";
import { createHash } from "crypto";

export type ParsedInventoryExcelRow = {
  rowNumber: number;
  selected: boolean;
  orderNo?: string;
  orderDate?: string;
  documentStatus?: string;
  warehouseCode?: string;
  warehouseName?: string;
  productCode?: string;
  productDescription?: string;
  uom?: string;
  quantity?: number;
  requestedQuantity?: number;
  requester?: string;
  cost?: number;
  batch?: string;
  lot?: string;
  sourceLineId?: string;
  sourceLineKey: string;
  sourceFingerprint: string;
  errors: string[];
  errorCode?: string;
};

export type ParsedInventoryWorkbook = {
  sheetName: string;
  totalRows: number;
  selectedRows: number;
  rows: ParsedInventoryExcelRow[];
  unselectedIgnored: number;
};

const HEADER_ALIASES: Record<string, string[]> = {
  orderNo: ["order no", "order number", "orderno", "document no", "doc no", "docno"],
  orderDate: ["order date", "document date", "doc date", "date"],
  documentStatus: ["document status", "status", "doc status", "erp status"],
  warehouseCode: ["warehouse code", "wh code", "location code", "store code", "warehouse"],
  warehouseName: ["warehouse name", "wh name", "location name", "store name"],
  productCode: ["product code", "item code", "part number", "part no", "sku", "item no"],
  productDescription: ["product description", "item description", "description", "part name", "item name"],
  uom: ["uom", "unit", "unit of measure"],
  quantity: ["quantity", "qty", "qty on hand", "quantity on hand"],
  requestedQuantity: ["requested quantity", "requested qty", "req qty"],
  requester: ["requester", "requested by", "user"],
  cost: ["cost", "unit cost", "unit price", "price"],
  batch: ["batch", "batch no", "batch number"],
  lot: ["lot", "lot no", "lot number"],
  sourceLineId: ["source line id", "erp source line id", "line id", "erp_source_line_id", "unique id"]
};

const YELLOW_ARGB = new Set([
  "FFFFFF00",
  "FFFF00",
  "FFFFFF99",
  "FFFF99",
  "FFFFF2CC",
  "FFF2CC",
  "FFFFEB9C",
  "FFEB9C",
  "FFFFC000",
  "FFC000",
  "FFFFD966",
  "FFD966"
]);

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_./]+/g, " ")
    .replace(/\s+/g, " ");
}

function cellText(value: ExcelJS.CellValue | undefined): string {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  if (typeof value === "object" && "result" in value) {
    return String((value as ExcelJS.CellFormulaValue).result ?? "").trim();
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function parseNumber(raw: string): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/,/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

function argbFromFill(fill: ExcelJS.Fill | undefined): string[] {
  if (!fill || fill.type !== "pattern") {
    return [];
  }
  const pattern = fill as ExcelJS.FillPattern;
  const colors: string[] = [];
  const fg = pattern.fgColor?.argb;
  const bg = pattern.bgColor?.argb;
  if (fg) colors.push(fg.toUpperCase());
  if (bg) colors.push(bg.toUpperCase());
  const theme = pattern.fgColor?.theme;
  // Excel highlight yellow often uses theme+tint; treat known yellow-ish theme fills via argb only.
  if (theme == null && colors.length === 0 && pattern.pattern === "solid") {
    return [];
  }
  return colors;
}

export function isYellowFill(fill: ExcelJS.Fill | undefined): boolean {
  const colors = argbFromFill(fill);
  return colors.some((color) => {
    const normalized = color.length === 6 ? `FF${color}` : color;
    if (YELLOW_ARGB.has(normalized) || YELLOW_ARGB.has(color)) {
      return true;
    }
    const rgb = normalized.slice(-6);
    const r = parseInt(rgb.slice(0, 2), 16);
    const g = parseInt(rgb.slice(2, 4), 16);
    const b = parseInt(rgb.slice(4, 6), 16);
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) && r >= 200 && g >= 180 && b <= 140;
  });
}

function mapHeaders(headerRow: ExcelJS.Row): Map<number, keyof typeof HEADER_ALIASES> {
  const mapped = new Map<number, keyof typeof HEADER_ALIASES>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = normalizeHeader(cellText(cell.value));
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(header)) {
        mapped.set(colNumber, field as keyof typeof HEADER_ALIASES);
      }
    }
  });
  return mapped;
}

function fingerprint(fields: Record<string, string | number | undefined>): string {
  const stable = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key] ?? ""}`)
    .join("|");
  return createHash("sha256").update(stable).digest("hex");
}

export async function parseInventoryWorkbook(buffer: Buffer): Promise<ParsedInventoryWorkbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new Error("MALFORMED_WORKBOOK");
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("MALFORMED_WORKBOOK");
  }

  const headerRow = sheet.getRow(1);
  const headerMap = mapHeaders(headerRow);
  if (headerMap.size === 0) {
    throw new Error("MALFORMED_WORKBOOK");
  }

  const rows: ParsedInventoryExcelRow[] = [];
  const seenKeys = new Set<string>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    let selected = false;
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (isYellowFill(cell.fill)) {
        selected = true;
      }
    });

    const values: Partial<Record<keyof typeof HEADER_ALIASES, string>> = {};
    headerMap.forEach((field, colNumber) => {
      values[field] = cellText(row.getCell(colNumber).value);
    });

    const quantity = parseNumber(values.quantity ?? "");
    const requestedQuantity = parseNumber(values.requestedQuantity ?? "");
    const cost = parseNumber(values.cost ?? "");
    const sourceLineId = values.sourceLineId?.trim() || undefined;
    const sourceFingerprint = fingerprint({
      orderNo: values.orderNo,
      orderDate: values.orderDate,
      warehouseCode: values.warehouseCode,
      productCode: values.productCode,
      quantity,
      lot: values.lot,
      batch: values.batch,
      sourceLineId
    });
    const sourceLineKey = sourceLineId ? `ERP:${sourceLineId}` : `FP:${sourceFingerprint}`;

    const errors: string[] = [];
    let errorCode: string | undefined;
    if (selected) {
      if (!values.productCode) {
        errors.push("Product code is required");
        errorCode = "UNKNOWN_ITEM";
      }
      if (quantity == null || !Number.isInteger(quantity) || quantity <= 0) {
        errors.push("Quantity must be a whole number greater than 0");
        errorCode = errorCode ?? "INVALID_QUANTITY";
      }
      if (seenKeys.has(sourceLineKey)) {
        errors.push("Duplicate source line in workbook");
        errorCode = "DUPLICATE_SOURCE_LINE";
      }
      seenKeys.add(sourceLineKey);
    }

    rows.push({
      rowNumber,
      selected,
      orderNo: values.orderNo || undefined,
      orderDate: values.orderDate || undefined,
      documentStatus: values.documentStatus || undefined,
      warehouseCode: values.warehouseCode || undefined,
      warehouseName: values.warehouseName || undefined,
      productCode: values.productCode || undefined,
      productDescription: values.productDescription || undefined,
      uom: values.uom || undefined,
      quantity,
      requestedQuantity,
      requester: values.requester || undefined,
      cost,
      batch: values.batch || undefined,
      lot: values.lot || undefined,
      sourceLineId,
      sourceLineKey,
      sourceFingerprint,
      errors,
      errorCode
    });
  });

  const selectedRows = rows.filter((row) => row.selected).length;
  return {
    sheetName: sheet.name,
    totalRows: rows.length,
    selectedRows,
    unselectedIgnored: rows.length - selectedRows,
    rows
  };
}

export type NormalizedDocumentStatus = "DRAFT" | "RELEASED" | "DELETED" | "REVERSED" | "UNKNOWN";

export function normalizeDocumentStatus(raw?: string | null): NormalizedDocumentStatus {
  const value = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!value) return "UNKNOWN";
  if (["DRAFT", "OPEN", "PENDING", "NOT_RELEASED"].includes(value)) return "DRAFT";
  if (["RELEASED", "POSTED", "APPROVED", "COMPLETED", "SHIPPED"].includes(value)) return "RELEASED";
  if (["DELETED", "CANCELLED", "CANCELED", "VOID"].includes(value)) return "DELETED";
  if (["REVERSED", "REVERSAL", "CREDIT"].includes(value)) return "REVERSED";
  return "UNKNOWN";
}
