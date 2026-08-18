import ExcelJS from "exceljs";

import { isYellowFill, normalizeDocumentStatus, parseInventoryWorkbook } from "../src/modules/inventory/inventory-excel-parse.util";

async function workbookBuffer(build: (sheet: ExcelJS.Worksheet) => void): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Stock");
  build(sheet);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("inventory excel yellow-row import parser", () => {
  it("selects the entire row when any yellow fill is present and ignores unselected rows", async () => {
    const buffer = await workbookBuffer((sheet) => {
      sheet.addRow(["Product Code", "Warehouse Code", "Quantity", "Document Status", "Source Line ID"]);
      const selected = sheet.addRow(["BRG-001", "MAIN", 5, "Released", "ERP-1"]);
      selected.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
      sheet.addRow(["OIL-001", "MAIN", 9, "Released", "ERP-2"]);
    });

    const parsed = await parseInventoryWorkbook(buffer);
    expect(parsed.selectedRows).toBe(1);
    expect(parsed.unselectedIgnored).toBe(1);
    expect(parsed.rows[0].selected).toBe(true);
    expect(parsed.rows[0].productCode).toBe("BRG-001");
    expect(parsed.rows[0].quantity).toBe(5);
    expect(parsed.rows[1].selected).toBe(false);
  });

  it("rejects malformed workbooks", async () => {
    await expect(parseInventoryWorkbook(Buffer.from("not-an-xlsx"))).rejects.toThrow("MALFORMED_WORKBOOK");
  });

  it("flags invalid quantity on selected rows", async () => {
    const buffer = await workbookBuffer((sheet) => {
      sheet.addRow(["Product Code", "Quantity", "Document Status"]);
      const selected = sheet.addRow(["BRG-001", -2, "Released"]);
      selected.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
    });
    const parsed = await parseInventoryWorkbook(buffer);
    expect(parsed.rows[0].errorCode).toBe("INVALID_QUANTITY");
  });

  it("normalizes ERP document statuses without guessing unknowns", () => {
    expect(normalizeDocumentStatus("Draft")).toBe("DRAFT");
    expect(normalizeDocumentStatus("Released")).toBe("RELEASED");
    expect(normalizeDocumentStatus("Deleted")).toBe("DELETED");
    expect(normalizeDocumentStatus("Reversed")).toBe("REVERSED");
    expect(normalizeDocumentStatus("Mystery")).toBe("UNKNOWN");
  });

  it("detects yellow fills", () => {
    expect(isYellowFill({ type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } })).toBe(true);
    expect(isYellowFill({ type: "pattern", pattern: "solid", fgColor: { argb: "FF00FF00" } })).toBe(false);
  });
});
