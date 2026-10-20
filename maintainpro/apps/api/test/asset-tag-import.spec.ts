import { previewAssetTagImport } from "../src/modules/assets/asset-tag-import";

const assets = [
  { id: "a1", kind: "asset" as const, label: "Pump", assetTag: "AST-OLD1", serialNumber: "SN-1" }
];

describe("asset tag preview", () => {
  it("accepts a valid new tag matched by serial number", () => {
    const [row] = previewAssetTagImport([{ rowNumber: 2, assetTag: "AST-NEW1", serialNumber: "SN-1" }], assets);
    expect(row.status).toBe("valid");
    expect(row.action).toBe("replace");
  });

  it("rejects a duplicate tag in the file and an unknown match", () => {
    const rows = previewAssetTagImport(
      [
        { rowNumber: 2, assetTag: "AST-NEW1", serialNumber: "SN-1" },
        { rowNumber: 3, assetTag: "AST-NEW1", serialNumber: "SN-1" },
        { rowNumber: 4, assetTag: "AST-NEW2", serialNumber: "MISSING" }
      ],
      assets
    );
    expect(rows[1].message).toContain("Duplicate");
    expect(rows[2].message).toContain("No asset");
  });
});
