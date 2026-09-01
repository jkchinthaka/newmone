import { Injectable } from "@nestjs/common";
import { parse as parseCsvSync } from "csv-parse/sync";
import ExcelJS from "exceljs";

import { BULK_IMPORT_MAX_BYTES, BULK_IMPORT_MAX_COLUMNS, BULK_IMPORT_MAX_ROWS } from "./bulk-import.constants";

export type BulkImportFileFormat = "csv" | "xlsx";

export interface BulkImportParsedRow {
  /** 1-based spreadsheet row number (header is row 1, so first data row is 2). */
  rowNumber: number;
  values: Record<string, unknown>;
}

export interface BulkImportParsedFile {
  format: BulkImportFileFormat;
  headers: string[];
  rows: BulkImportParsedRow[];
}

export class BulkImportFileError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

const UNSUPPORTED_EXTENSIONS = [".xls", ".xlsm", ".xlsb", ".doc", ".docx", ".pdf", ".zip", ".exe", ".bat", ".sh", ".json"];

function detectFormat(originalname: string | undefined): BulkImportFileFormat {
  const name = String(originalname ?? "").toLowerCase().trim();
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".xlsx")) return "xlsx";
  if (UNSUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    throw new BulkImportFileError(
      "UNSUPPORTED_FILE_TYPE",
      "Unsupported file type. Only .csv and .xlsx files are accepted (macro-enabled and legacy .xls workbooks are rejected)."
    );
  }
  throw new BulkImportFileError("UNSUPPORTED_FILE_TYPE", "Only .csv and .xlsx files are accepted.");
}

@Injectable()
export class BulkImportParserService {
  async parse(file: {
    originalname?: string;
    mimetype?: string;
    size?: number;
    buffer?: Buffer;
  }): Promise<BulkImportParsedFile> {
    if (!file.buffer || file.buffer.length === 0) {
      throw new BulkImportFileError("EMPTY_FILE", "The uploaded file is empty.");
    }

    const size = file.size ?? file.buffer.length;
    if (size > BULK_IMPORT_MAX_BYTES) {
      throw new BulkImportFileError(
        "FILE_TOO_LARGE",
        `File exceeds the ${Math.floor(BULK_IMPORT_MAX_BYTES / (1024 * 1024))} MB limit.`
      );
    }

    const format = detectFormat(file.originalname);
    const parsed = format === "csv" ? this.parseCsv(file.buffer) : await this.parseXlsx(file.buffer);

    if (parsed.headers.length === 0) {
      throw new BulkImportFileError("MISSING_HEADERS", "Could not detect column headers in the uploaded file.");
    }
    if (parsed.headers.length > BULK_IMPORT_MAX_COLUMNS) {
      throw new BulkImportFileError("TOO_MANY_COLUMNS", `File has more than ${BULK_IMPORT_MAX_COLUMNS} columns.`);
    }
    if (parsed.rows.length === 0) {
      throw new BulkImportFileError("NO_DATA_ROWS", "The file has no data rows below the header.");
    }
    if (parsed.rows.length > BULK_IMPORT_MAX_ROWS) {
      throw new BulkImportFileError("TOO_MANY_ROWS", `File exceeds the ${BULK_IMPORT_MAX_ROWS} row limit.`);
    }

    return { format, headers: parsed.headers, rows: parsed.rows };
  }

  private parseCsv(buffer: Buffer): { headers: string[]; rows: BulkImportParsedRow[] } {
    let table: string[][];
    try {
      table = parseCsvSync(buffer, {
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true
      }) as string[][];
    } catch {
      throw new BulkImportFileError(
        "MALFORMED_CSV",
        "The CSV file could not be parsed. Check for unescaped commas, quotes, or an inconsistent column count."
      );
    }

    if (table.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = table[0].map((header) => String(header ?? "").trim()).filter(Boolean);
    const rows: BulkImportParsedRow[] = table.slice(1).map((line, index) => {
      const values: Record<string, unknown> = {};
      headers.forEach((header, columnIndex) => {
        values[header] = line[columnIndex] ?? "";
      });
      return { rowNumber: index + 2, values };
    });

    return { headers, rows };
  }

  private async parseXlsx(buffer: Buffer): Promise<{ headers: string[]; rows: BulkImportParsedRow[] }> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch {
      throw new BulkImportFileError("MALFORMED_XLSX", "The workbook could not be read. Upload a valid .xlsx file.");
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BulkImportFileError("MALFORMED_XLSX", "The workbook has no worksheets.");
    }

    const headerByCol = new Map<number, string>();
    const headers: string[] = [];
    worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const label = String(this.cellToPlain(cell.value) ?? "").trim();
      if (!label) return;
      headerByCol.set(colNumber, label);
      headers.push(label);
    });

    const rows: BulkImportParsedRow[] = [];
    const lastRow = worksheet.rowCount || 1;
    for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const values: Record<string, unknown> = {};
      let anyValue = false;
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const header = headerByCol.get(colNumber);
        if (!header) return;
        values[header] = this.cellToPlain(cell.value);
        anyValue = true;
      });
      if (!anyValue) continue;
      rows.push({ rowNumber, values });
    }

    return { headers, rows };
  }

  private cellToPlain(value: ExcelJS.CellValue): unknown {
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
}
