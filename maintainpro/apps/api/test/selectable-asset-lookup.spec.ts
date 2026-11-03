import { AssetStatus } from "@prisma/client";

import { MaintenanceRequestsService } from "../src/modules/maintenance-requests/maintenance-requests.service";
import { selectableAssetLookupWhere } from "../src/modules/maintenance-requests/selectable-asset-lookup";

describe("selectable asset lookup", () => {
  it("filters tag, name, and serial in the query before pagination", () => {
    const where = selectableAssetLookupWhere("tenant-a", "  SN-2026-00458  ");
    expect(where).toEqual({
      tenantId: "tenant-a",
      isActive: true,
      archivedAt: null,
      status: {
        notIn: [AssetStatus.DRAFT, AssetStatus.RETIRED, AssetStatus.DISPOSED, AssetStatus.INACTIVE]
      },
      OR: [
        { assetTag: { contains: "SN-2026-00458" } },
        { name: { contains: "SN-2026-00458" } },
        { serialNumber: { contains: "SN-2026-00458" } }
      ]
    });
    expect(JSON.stringify(where)).not.toContain("mode");
  });

  it("keeps partial serial fragments in the SQL filter", () => {
    for (const fragment of ["SN", "2026", "00458", "SN-2026", "sn-2026-00458"]) {
      const where = selectableAssetLookupWhere("tenant-a", fragment);
      const or = where.OR as Array<{ serialNumber?: { contains: string } }>;
      expect(or.some((clause) => clause.serialNumber?.contains === fragment.trim())).toBe(true);
    }
  });

  it("returns only selection fields and ignores a stale empty query", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "asset-1",
        assetTag: "AST-00254",
        name: "Industrial Water Pump",
        serialNumber: "SN-2026-00458",
        siteId: "site-1",
        functionalLocationId: "loc-1",
        site: { name: "Farm 02" },
        functionalLocation: { name: "Pump House" }
      }
    ]);
    const service = new MaintenanceRequestsService(
      { asset: { findMany, findFirst: jest.fn() } } as never,
      {} as never,
      {} as never,
      {} as never
    );

    const rows = await service.lookupSelectableAssets("tenant-a", " 00458 ", 50);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 15,
        where: expect.objectContaining({
          tenantId: "tenant-a",
          OR: expect.arrayContaining([{ serialNumber: { contains: "00458" } }])
        }),
        select: expect.objectContaining({
          id: true,
          assetTag: true,
          serialNumber: true,
          name: true
        })
      })
    );
    expect(rows[0]).toEqual({
      id: "asset-1",
      assetTag: "AST-00254",
      name: "Industrial Water Pump",
      serialNumber: "SN-2026-00458",
      siteId: "site-1",
      functionalLocationId: "loc-1",
      siteName: "Farm 02",
      locationName: "Pump House"
    });
    expect(rows[0]).not.toHaveProperty("purchasePrice");
    await expect(service.lookupSelectableAssets("tenant-a", "   ")).rejects.toThrow(
      /code, name, or serial/i
    );
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
