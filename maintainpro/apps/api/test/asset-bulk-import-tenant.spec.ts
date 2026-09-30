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
});
