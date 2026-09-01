import ExcelJS from "exceljs";

import { BulkImportFileError, BulkImportParserService } from "../src/modules/bulk-import/bulk-import-parser.service";
import { BULK_IMPORT_MAX_BYTES } from "../src/modules/bulk-import/bulk-import.constants";

async function xlsxBuffer(rows: Array<Record<string, string | number>>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  const headers = Object.keys(rows[0]);
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(headers.map((header) => row[header])));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("BulkImportParserService", () => {
  const parser = new BulkImportParserService();

  it("parses a well-formed CSV file", async () => {
    const buffer = Buffer.from("Code,Name\nMAINT,Maintenance\nOPS,Operations\n", "utf-8");
    const result = await parser.parse({ originalname: "departments.csv", buffer, size: buffer.length });
    expect(result.format).toBe("csv");
    expect(result.headers).toEqual(["Code", "Name"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ rowNumber: 2, values: { Code: "MAINT", Name: "Maintenance" } });
  });

  it("parses a well-formed XLSX file", async () => {
    const buffer = await xlsxBuffer([
      { Code: "MAINT", Name: "Maintenance" },
      { Code: "OPS", Name: "Operations" }
    ]);
    const result = await parser.parse({ originalname: "departments.xlsx", buffer, size: buffer.length });
    expect(result.format).toBe("xlsx");
    expect(result.headers).toEqual(["Code", "Name"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].values).toEqual({ Code: "MAINT", Name: "Maintenance" });
  });

  it("rejects an empty file", async () => {
    await expect(parser.parse({ originalname: "empty.csv", buffer: Buffer.alloc(0), size: 0 })).rejects.toMatchObject({
      code: "EMPTY_FILE"
    });
  });

  it("rejects a file over the size limit", async () => {
    const buffer = Buffer.alloc(BULK_IMPORT_MAX_BYTES + 1, "a");
    await expect(parser.parse({ originalname: "big.csv", buffer, size: buffer.length })).rejects.toMatchObject({
      code: "FILE_TOO_LARGE"
    });
  });

  it("rejects unsupported file types (including legacy .xls and macro-enabled .xlsm)", async () => {
    const buffer = Buffer.from("not really a spreadsheet");
    await expect(parser.parse({ originalname: "data.xls", buffer, size: buffer.length })).rejects.toMatchObject({
      code: "UNSUPPORTED_FILE_TYPE"
    });
    await expect(parser.parse({ originalname: "data.xlsm", buffer, size: buffer.length })).rejects.toMatchObject({
      code: "UNSUPPORTED_FILE_TYPE"
    });
    await expect(parser.parse({ originalname: "data.exe", buffer, size: buffer.length })).rejects.toMatchObject({
      code: "UNSUPPORTED_FILE_TYPE"
    });
  });

  it("rejects malformed CSV content", async () => {
    const buffer = Buffer.from('Code,Name\n"unterminated,Maintenance\n', "utf-8");
    await expect(parser.parse({ originalname: "bad.csv", buffer, size: buffer.length })).rejects.toBeInstanceOf(
      BulkImportFileError
    );
  });

  it("rejects a file with no data rows", async () => {
    const buffer = Buffer.from("Code,Name\n", "utf-8");
    await expect(parser.parse({ originalname: "headers-only.csv", buffer, size: buffer.length })).rejects.toMatchObject({
      code: "NO_DATA_ROWS"
    });
  });

  it("rejects a file that exceeds the row limit", async () => {
    const lines = ["Code,Name"];
    for (let i = 0; i < 5_001; i += 1) {
      lines.push(`C${i},Name ${i}`);
    }
    const buffer = Buffer.from(`${lines.join("\n")}\n`, "utf-8");
    await expect(parser.parse({ originalname: "too-many.csv", buffer, size: buffer.length })).rejects.toMatchObject({
      code: "TOO_MANY_ROWS"
    });
  });

  it("rejects a file that exceeds the column limit", async () => {
    const headers = Array.from({ length: 51 }, (_, i) => `Col${i}`);
    const values = headers.map((_, i) => `v${i}`);
    const buffer = Buffer.from(`${headers.join(",")}\n${values.join(",")}\n`, "utf-8");
    await expect(parser.parse({ originalname: "too-wide.csv", buffer, size: buffer.length })).rejects.toMatchObject({
      code: "TOO_MANY_COLUMNS"
    });
  });
});
