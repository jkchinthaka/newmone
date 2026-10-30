import * as XLSX from "xlsx";

import { apiClient } from "@/lib/api-client";

/** Goods in (GRN): receive spare parts into the MaintainPro store, from a form or an Excel file. */
export type GoodsInLine = {
  partId?: string;
  partNumber?: string;
  name?: string;
  category?: string;
  unit?: string;
  quantity: number | string;
  unitCost?: number | string | null;
  supplierName?: string;
  referenceNo?: string;
};

export type GoodsInCheckedLine = {
  row: number;
  status: "OK" | "NEW" | "ERROR";
  message?: string;
  partId?: string;
  partNumber: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number | null;
  supplierName: string | null;
  referenceNo: string | null;
  currentOnHand?: number;
};

export type GoodsInPreview = {
  lines: GoodsInCheckedLine[];
  counts: { total: number; ok: number; newParts: number; errors: number };
  totalQuantity: number;
};

export type GoodsInResult = {
  store: { id: string; name: string };
  lines: number;
  newParts: number;
  totalQuantity: number;
  totalValue: number;
  referenceNo: string | null;
};

export const GOODS_IN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "INVENTORY_KEEPER"]);
export const GOODS_IN_MAX_LINES = 500;

export function canDoGoodsIn(role: string | null | undefined): boolean {
  return GOODS_IN_ROLES.has(String(role ?? "").toUpperCase());
}

export async function previewGoodsIn(lines: GoodsInLine[]): Promise<GoodsInPreview> {
  const response = await apiClient.post("/inventory/goods-in/preview", { lines });
  return response.data?.data as GoodsInPreview;
}

export async function receiveGoodsIn(
  body: {
    lines: GoodsInLine[];
    referenceNo?: string;
    supplierName?: string;
    receivedDate?: string;
    notes?: string;
    idempotencyKey: string;
  },
  grnPhoto?: File | null
): Promise<GoodsInResult> {
  // Multipart: the delivery as JSON next to the GRN / invoice photo.
  const form = new FormData();
  form.append("payload", JSON.stringify(body));
  if (grnPhoto) form.append("grnPhoto", grnPhoto);
  const response = await apiClient.post("/inventory/goods-in", form);
  return response.data?.data as GoodsInResult;
}

/** Template columns, in order. Part name / Category / Unit are only needed for new part codes. */
export const GOODS_IN_TEMPLATE_HEADERS = [
  "Part code",
  "Part name",
  "Category",
  "Unit",
  "Quantity",
  "Unit cost",
  "Supplier",
  "GRN / Invoice no"
] as const;

const HEADER_ALIASES: Record<keyof Omit<GoodsInLine, "partId">, string[]> = {
  partNumber: ["part code", "code", "part number", "part no", "item code", "erp code", "sku"],
  name: ["part name", "name", "item name", "description", "item"],
  category: ["category", "group"],
  unit: ["unit", "uom", "units"],
  quantity: ["quantity", "qty", "received qty", "received quantity"],
  unitCost: ["unit cost", "cost", "unit price", "price", "rate"],
  supplierName: ["supplier", "vendor", "supplier name"],
  referenceNo: ["grn / invoice no", "grn", "grn no", "invoice", "invoice no", "reference", "ref", "po"]
};

function headerKey(header: string): keyof typeof HEADER_ALIASES | null {
  const clean = header.trim().toLowerCase().replace(/\s+/g, " ");
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(clean)) return key as keyof typeof HEADER_ALIASES;
  }
  return null;
}

/** Turns sheet rows (header row first) into goods-in lines. Blank rows are skipped. */
export function goodsInLinesFromRows(rows: unknown[][]): { lines: GoodsInLine[]; missingColumns: string[] } {
  const [header = [], ...body] = rows;
  const columns = header.map((cell) => headerKey(String(cell ?? "")));
  const missingColumns = [
    ...(columns.includes("partNumber") ? [] : ["Part code"]),
    ...(columns.includes("quantity") ? [] : ["Quantity"])
  ];
  const lines: GoodsInLine[] = [];
  for (const row of body) {
    const values: Record<string, string> = {};
    columns.forEach((key, index) => {
      if (key) values[key] = String(row[index] ?? "").trim();
    });
    if (!Object.values(values).some(Boolean)) continue;
    lines.push({
      partNumber: values.partNumber || undefined,
      name: values.name || undefined,
      category: values.category || undefined,
      unit: values.unit || undefined,
      quantity: values.quantity ?? "",
      unitCost: values.unitCost ? values.unitCost : null,
      supplierName: values.supplierName || undefined,
      referenceNo: values.referenceNo || undefined
    });
  }
  return { lines, missingColumns };
}

export async function readGoodsInWorkbook(file: File): Promise<{ lines: GoodsInLine[]; missingColumns: string[] }> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!sheet) return { lines: [], missingColumns: ["Part code", "Quantity"] };
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
  return goodsInLinesFromRows(rows);
}

export function downloadGoodsInTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([
    [...GOODS_IN_TEMPLATE_HEADERS],
    ["BRG-6204", "Bearing 6204", "Bearings", "pcs", 10, 850, "ABC Traders", "GRN-1001"],
    ["BELT-A42", "V belt A42", "Belts", "pcs", 4, 1200, "ABC Traders", "GRN-1001"]
  ]);
  sheet["!cols"] = [{ wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 18 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Goods in");
  XLSX.writeFile(workbook, "goods-in-template.xlsx");
}

/** Problems with the one-item form before it is sent. */
export function goodsInFormIssues(form: {
  partId: string;
  newPart: boolean;
  partNumber: string;
  name: string;
  quantity: string;
  unitCost: string;
}): string[] {
  const issues: string[] = [];
  if (form.newPart) {
    if (!form.partNumber.trim()) issues.push("Enter the part code.");
    if (!form.name.trim()) issues.push("Enter the part name.");
  } else if (!form.partId) {
    issues.push("Choose the part, or tick New part.");
  }
  const quantity = Number(form.quantity);
  if (!form.quantity.trim() || !Number.isInteger(quantity) || quantity <= 0) issues.push("Quantity must be a whole number above 0.");
  if (form.unitCost.trim() && !(Number(form.unitCost) >= 0)) issues.push("Unit cost must be a number.");
  return issues;
}
