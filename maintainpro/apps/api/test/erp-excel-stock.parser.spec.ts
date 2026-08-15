import { createHash } from "crypto";

import ExcelJS from "exceljs";

import {
  assertXlsxUpload,
  inspectErpExcelWorkbook,
  materializeRowsFromStaging,
  mappingIsComplete
} from "../src/modules/inventory/erp-excel-stock.parser";
import { normalizeErpItemCode } from "../src/modules/inventory/erp-stock-sync.mapper";

async function buildWorkbook(rows: Array<Record<string, string | number>>, sheetName = "Stock") {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  const headers = Object.keys(rows[0] ?? { "Item Code": "", Qty: "" });
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(headers.map((header) => row[header]));
  }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return buffer;
}

describe("ERP Excel stock parser", () => {
  it("accepts valid xlsx and auto-maps common aliases", async () => {
    const buffer = await buildWorkbook([
      { "Item Code": "09CS41", Qty: 20, "Item Name": "Seal" },
      { "Item Code": "BRG-001", Qty: 5 }
    ]);
    const insight = await inspectErpExcelWorkbook(buffer);
    expect(insight.suggestedMapping.itemCode).toBeTruthy();
    expect(insight.suggestedMapping.quantity).toBeTruthy();
    expect(insight.rows).toHaveLength(2);
    expect(insight.rows[0].itemCode).toBe("09CS41");
    expect(insight.rows[0].quantity).toBe(20);
  });

  it("rejects non-xlsx extensions", () => {
    expect(() =>
      assertXlsxUpload({ originalname: "stock.xls", buffer: Buffer.from("x"), size: 1 })
    ).toThrow();
    expect(() =>
      assertXlsxUpload({ originalname: "stock.csv", buffer: Buffer.from("x"), size: 1 })
    ).toThrow();
  });

  it("rejects corrupt workbook buffers", async () => {
    await expect(inspectErpExcelWorkbook(Buffer.from("not-an-xlsx"))).rejects.toMatchObject({
      code: "UNSUPPORTED_WORKBOOK"
    });
  });

  it("flags missing item code / quantity mapping as low confidence", async () => {
    const buffer = await buildWorkbook([{ Foo: "A", Bar: 1 }]);
    const insight = await inspectErpExcelWorkbook(buffer);
    expect(insight.mappingConfidence).toBe("low");
    expect(mappingIsComplete(insight.suggestedMapping)).toBe(false);
  });

  it("supports manual column mapping via staging records", async () => {
    const buffer = await buildWorkbook([{ SKU: "09CS41", Balance: 12 }]);
    const insight = await inspectErpExcelWorkbook(buffer);
    const mapped = materializeRowsFromStaging(insight.stagingRecords, {
      itemCode: "SKU",
      quantity: "Balance"
    });
    expect(mapped.rows[0].itemCode).toBe("09CS41");
    expect(mapped.rows[0].quantity).toBe(12);
  });

  it("marks negative and decimal quantities invalid", async () => {
    const buffer = await buildWorkbook([
      { "Item Code": "A", Qty: -1 },
      { "Item Code": "B", Qty: 1.5 },
      { "Item Code": "C", Qty: 0 }
    ]);
    const insight = await inspectErpExcelWorkbook(buffer);
    expect(insight.rows.find((row) => row.itemCode === "A")?.invalidReason).toMatch(/Negative/i);
    expect(insight.rows.find((row) => row.itemCode === "B")?.invalidReason).toMatch(/whole number/i);
    expect(insight.rows.find((row) => row.itemCode === "C")?.quantity).toBe(0);
  });

  it("detects multiple warehouses", async () => {
    const buffer = await buildWorkbook([
      { "Item Code": "A", Qty: 1, Warehouse: "WH1" },
      { "Item Code": "B", Qty: 2, Warehouse: "WH2" }
    ]);
    const insight = await inspectErpExcelWorkbook(buffer);
    expect(insight.warehousesDetected).toEqual(["WH1", "WH2"]);
  });

  it("normalizes item codes for matching", () => {
    expect(normalizeErpItemCode(" 09cs41 ")).toBe("09CS41");
  });

  it("computes deterministic sha256 for idempotency fingerprint", async () => {
    const buffer = await buildWorkbook([{ "Item Code": "A", Qty: 1 }]);
    const hash = createHash("sha256").update(buffer).digest("hex");
    expect(hash).toHaveLength(64);
  });
});
