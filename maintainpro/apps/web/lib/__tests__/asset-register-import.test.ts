import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assetRegisterPayload, EMPTY_ASSET_REGISTER_FORM } from "../asset-register-flow";
import { assetRowsFromSheet, chunkForSave, importErrorsCsv, rowsToSave, type AssetImportLine } from "../asset-register-import";

const line = (row: number, status: AssetImportLine["status"], extra: Partial<AssetImportLine> = {}): AssetImportLine => ({
  row,
  status,
  messages: [],
  warnings: [],
  assetTag: `AST-MCH000${row}`,
  autoTag: false,
  name: `Asset ${row}`,
  display: { assetGroup: "", category: "", type: "", site: "", functionalLocation: "", department: "", responsiblePerson: "", parentAssetTag: "" },
  ...extra
});

describe("asset Excel import: reading the sheet", () => {
  it("matches template and older column names, skips blank rows, and keeps Excel row numbers", () => {
    const parsed = assetRowsFromSheet([
      ["Asset register 2026"],
      ["Asset group *", "Category *", "Machine Name", "Plant", "S/N", "Purchase date", "ERP code", "Colour"],
      ["Plant & Machinery", "Machine", "Filler 2", "Main Plant", "SN-1", 45366, "FA-9", "Red"],
      ["", "", "", "", "", "", "", ""],
      ["IT Hardware", "Laptop", "Laptop 7", "Main Plant", "", "", "", ""]
    ]);
    assert.deepEqual(parsed.missingColumns, []);
    assert.deepEqual(parsed.unknownColumns, ["Colour"]);
    assert.equal(parsed.rows.length, 2);
    assert.deepEqual(parsed.rows[0], {
      row: 3,
      assetGroup: "Plant & Machinery",
      category: "Machine",
      name: "Filler 2",
      site: "Main Plant",
      serialNumber: "SN-1",
      purchaseDate: "2024-03-15",
      fixedAssetCode: "FA-9"
    });
    assert.equal(parsed.rows[1].row, 5);
  });

  it("names the required columns that are missing", () => {
    assert.deepEqual(assetRowsFromSheet([["Name", "Serial number"], ["Pump", "1"]]).missingColumns, ["Asset group", "Category", "Site"]);
  });
});

describe("asset Excel import: saving", () => {
  const rows = [
    { row: 2, name: "Motor", parentAssetTag: "AST-MCH0003" },
    { row: 3, name: "Line", assetTag: "AST-MCH0003" },
    { row: 4, name: "Broken" },
    { row: 5, name: "Auto" }
  ];
  const lines = [
    line(2, "NEW", { parentRowTag: "AST-MCH0003" }),
    line(3, "NEW"),
    line(4, "ERROR", { messages: ["Site is missing."] }),
    line(5, "NEW", { assetTag: "AST-MCH0010", autoTag: true })
  ];

  it("sends only rows that can be saved, with the shown tag and the person's tag edits", () => {
    const sent = rowsToSave(rows, lines, { 2: "ast-mch0099 " });
    assert.deepEqual(
      sent.map((row) => [row.row, row.assetTag, row.autoTag]),
      [
        [2, "AST-MCH0099", false],
        [3, "AST-MCH0003", undefined],
        [5, "AST-MCH0010", true]
      ]
    );
  });

  it("puts parents before their children across save parts", () => {
    const chunks = chunkForSave(rowsToSave(rows, lines, {}), lines, 1);
    assert.deepEqual(chunks.map((chunk) => chunk[0].row), [3, 5, 2]);
  });

  it("writes a CSV of rows to fix", () => {
    assert.equal(importErrorsCsv([{ row: 4, assetTag: "", name: 'Pump "A"', message: "Site is missing." }]), 'Row,Asset tag,Name,Problem\n"4","","Pump ""A""","Site is missing."');
  });

  it("the one-asset form sends the ERP / fixed asset code", () => {
    const payload = assetRegisterPayload({ ...EMPTY_ASSET_REGISTER_FORM, category: "MACHINE", name: "Pump", assetTag: "ast-mch0001", fixedAssetCode: " FA-12 " });
    assert.equal(payload.fixedAssetCode, "FA-12");
    assert.equal(payload.status, "DRAFT");
  });
});
