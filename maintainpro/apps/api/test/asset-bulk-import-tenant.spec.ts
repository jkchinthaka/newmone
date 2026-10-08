import { AssetBulkImportAdapter } from "../src/modules/bulk-import/adapters/asset.adapter";

describe("asset bulk import tenant boundary", () => {
  it("looks up asset tags only inside the importing tenant", async () => {
    const findMany = jest.fn(async () => []);
    const adapter = new AssetBulkImportAdapter({ asset: { findMany } } as never);

    expect(adapter.naturalKeyTenantScoped).toBe(true);
    await adapter.findExisting("tenant-a", ["AT-1"]);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-a", assetTag: { in: ["AT-1"] } }
      })
    );
  });

  it("rejects a new asset tag that does not match AST-XXXX and stores a valid tag in uppercase", () => {
    const adapter = new AssetBulkImportAdapter({} as never);

    const rejected = adapter.normalizeRow({
      assetTag: "AT-1001",
      name: "Backup Generator",
      category: "EQUIPMENT"
    });
    expect(rejected.errors.some((issue) => issue.field === "assetTag" && issue.code === "INVALID_FORMAT")).toBe(
      true
    );

    const accepted = adapter.normalizeRow({
      assetTag: "ast-1001",
      name: "Backup Generator",
      category: "EQUIPMENT"
    });
    expect(accepted.errors).toEqual([]);
    expect(accepted.data.assetTag).toBe("AST-1001");
  });
});
