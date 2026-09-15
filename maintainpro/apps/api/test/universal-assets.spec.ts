import { BadRequestException } from "@nestjs/common";
import {
  AssetAttributeDataType,
  AssetCategory,
  AssetCondition,
  AssetCriticality,
  AssetStatus,
  Prisma
} from "@prisma/client";

import { AssetRegistryService } from "../src/modules/assets/asset-registry.service";
import { assertNoAssetHierarchyCycle, wouldCreateAssetCycle } from "../src/modules/assets/asset-hierarchy";
import { validateCustomAttributes } from "../src/modules/asset-taxonomy/attribute-validation";
import { AssetTaxonomyService } from "../src/modules/asset-taxonomy/asset-taxonomy.service";
import { mapLegacyAssetCategory } from "../src/modules/asset-taxonomy/legacy-category-map";

function uniqueError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0"
  });
}

describe("asset hierarchy helpers", () => {
  it("blocks self-parent", () => {
    expect(wouldCreateAssetCycle("a", "a", () => null)).toBe(true);
  });

  it("blocks descendant cycles", () => {
    const parents = new Map([
      ["b", "a"],
      ["c", "b"]
    ]);
    expect(wouldCreateAssetCycle("c", "a", (id) => parents.get(id) ?? null)).toBe(true);
  });

  it("allows valid parent", () => {
    const parents = new Map([["b", "a"]]);
    expect(wouldCreateAssetCycle("a", "c", (id) => parents.get(id) ?? null)).toBe(false);
  });

  it("assertNoAssetHierarchyCycle throws on cycle", async () => {
    await expect(
      assertNoAssetHierarchyCycle({
        assetId: "a",
        parentAssetId: "b",
        loadParentId: async (id) => (id === "b" ? "a" : null)
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("attribute validation", () => {
  const defs = [
    {
      key: "powerKw",
      label: "Power",
      dataType: AssetAttributeDataType.NUMBER,
      required: true,
      options: [] as string[],
      minValue: 0,
      maxValue: 1000,
      isActive: true
    },
    {
      key: "fuelType",
      label: "Fuel",
      dataType: AssetAttributeDataType.SELECT,
      required: false,
      options: ["DIESEL", "GAS"],
      minValue: null,
      maxValue: null,
      isActive: true
    }
  ];

  it("accepts valid values", () => {
    expect(validateCustomAttributes(defs, { powerKw: 15, fuelType: "DIESEL" })).toEqual({
      powerKw: 15,
      fuelType: "DIESEL"
    });
  });

  it("rejects unknown keys", () => {
    expect(() => validateCustomAttributes(defs, { powerKw: 1, hack: true })).toThrow(
      BadRequestException
    );
  });

  it("rejects missing required", () => {
    expect(() => validateCustomAttributes(defs, {})).toThrow(BadRequestException);
  });

  it("rejects invalid select", () => {
    expect(() => validateCustomAttributes(defs, { powerKw: 1, fuelType: "PETROL" })).toThrow(
      BadRequestException
    );
  });
});

describe("legacy category map", () => {
  it("maps VEHICLE deterministically", () => {
    expect(mapLegacyAssetCategory(AssetCategory.VEHICLE)).toMatchObject({
      domainCode: "FLEET",
      categoryCode: "VEHICLE"
    });
  });

  it("flags ambiguous EQUIPMENT", () => {
    expect(mapLegacyAssetCategory(AssetCategory.EQUIPMENT).ambiguous).toBe(true);
  });
});

describe("AssetTaxonomyService", () => {
  function createTaxonomyPrisma() {
    const domains = new Map<string, Record<string, unknown>>();
    const categories = new Map<string, Record<string, unknown>>();
    const types = new Map<string, Record<string, unknown>>();
    const attributes = new Map<string, Record<string, unknown>>();

    return {
      assetDomain: {
        findUnique: jest.fn(async ({ where }: { where: { tenantId_code?: { tenantId: string; code: string }; id?: string } }) => {
          if (where.tenantId_code) {
            return (
              [...domains.values()].find(
                (d) => d.tenantId === where.tenantId_code!.tenantId && d.code === where.tenantId_code!.code
              ) ?? null
            );
          }
          return domains.get(where.id!) ?? null;
        }),
        findFirst: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) => {
          const row = domains.get(where.id);
          return row && row.tenantId === where.tenantId ? row : null;
        }),
        findMany: jest.fn(async ({ where }: { where: { tenantId: string; isActive?: boolean } }) =>
          [...domains.values()].filter(
            (d) =>
              d.tenantId === where.tenantId &&
              (where.isActive === undefined || d.isActive === where.isActive)
          )
        ),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const dup = [...domains.values()].some(
            (d) => d.tenantId === data.tenantId && d.code === data.code
          );
          if (dup) throw uniqueError();
          const id = `dom-${domains.size + 1}`;
          const row = { id, isActive: true, description: null, sortOrder: 0, ...data };
          domains.set(id, row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const existing = domains.get(where.id)!;
          const next = { ...existing, ...data };
          domains.set(where.id, next);
          return next;
        }),
        count: jest.fn(async () => 0)
      },
      assetCategoryMaster: {
        findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
          for (const row of categories.values()) {
            if (where.id && row.id === where.id && row.tenantId === where.tenantId) return row;
            if (
              where.code &&
              row.code === where.code &&
              row.tenantId === where.tenantId &&
              row.domainId === where.domainId
            ) {
              return row;
            }
          }
          return null;
        }),
        findMany: jest.fn(async ({ where }: { where: { tenantId: string } }) =>
          [...categories.values()].filter((c) => c.tenantId === where.tenantId)
        ),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const id = `cat-${categories.size + 1}`;
          const row = { id, isActive: true, description: null, legacyEnum: null, ...data };
          categories.set(id, row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const existing = categories.get(where.id)!;
          const next = { ...existing, ...data };
          categories.set(where.id, next);
          return next;
        }),
        count: jest.fn(async () => categories.size)
      },
      assetTypeMaster: {
        findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
          for (const row of types.values()) {
            if (where.id && row.id === where.id && row.tenantId === where.tenantId) return row;
            if (
              where.code &&
              row.code === where.code &&
              row.tenantId === where.tenantId &&
              row.categoryId === where.categoryId
            ) {
              return row;
            }
          }
          return null;
        }),
        findMany: jest.fn(async ({ where }: { where: { tenantId: string } }) =>
          [...types.values()].filter((t) => t.tenantId === where.tenantId)
        ),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const id = `type-${types.size + 1}`;
          const row = { id, isActive: true, description: null, ...data };
          types.set(id, row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const existing = types.get(where.id)!;
          const next = { ...existing, ...data };
          types.set(where.id, next);
          return next;
        })
      },
      assetAttributeDefinition: {
        findMany: jest.fn(async ({ where }: { where: { tenantId: string } }) =>
          [...attributes.values()].filter((a) => a.tenantId === where.tenantId)
        ),
        findFirst: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) => {
          const row = attributes.get(where.id);
          return row && row.tenantId === where.tenantId ? row : null;
        }),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const id = `attr-${attributes.size + 1}`;
          const row = { id, isActive: true, options: [], ...data };
          attributes.set(id, row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const existing = attributes.get(where.id)!;
          const next = { ...existing, ...data };
          attributes.set(where.id, next);
          return next;
        })
      },
      asset: {
        count: jest.fn(async () => 1)
      },
      auditLog: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => data)
      },
      _domains: domains,
      _categories: categories
    };
  }

  it("creates domain and blocks cross-tenant lookup", async () => {
    const prisma = createTaxonomyPrisma();
    const service = new AssetTaxonomyService(prisma as never);
    const domain = await service.createDomain("tenant-a", { code: "UTILITIES", name: "Utilities" });
    expect(domain.code).toBe("UTILITIES");
    await expect(service.updateDomain("tenant-b", domain.id as string, { name: "X" })).rejects.toBeInstanceOf(
      Error
    );
  });

  it("deactivates domain without hard delete", async () => {
    const prisma = createTaxonomyPrisma();
    const service = new AssetTaxonomyService(prisma as never);
    const domain = await service.createDomain("tenant-a", { code: "FLEET", name: "Fleet" });
    const updated = await service.deactivateDomain("tenant-a", domain.id as string);
    expect(updated.isActive).toBe(false);
  });

  it("blocks hard delete when referenced", async () => {
    const prisma = createTaxonomyPrisma();
    const service = new AssetTaxonomyService(prisma as never);
    const domain = await service.createDomain("tenant-a", { code: "OTHER", name: "Other" });
    await expect(service.assertCanHardDeleteDomain("tenant-a", domain.id as string)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("category requires valid domain", async () => {
    const prisma = createTaxonomyPrisma();
    const service = new AssetTaxonomyService(prisma as never);
    await expect(
      service.createCategory("tenant-a", {
        domainId: "missing",
        code: "PUMP",
        name: "Pump"
      })
    ).rejects.toBeInstanceOf(Error);
  });
});

describe("AssetRegistryService movement and lifecycle", () => {
  function createRegistryPrisma() {
    const assets = new Map<string, Record<string, unknown>>();
    const sites = new Map<string, Record<string, unknown>>();
    const locations = new Map<string, Record<string, unknown>>();
    const histories: Record<string, unknown>[] = [];
    const audits: Record<string, unknown>[] = [];
    const vehicles = new Map<string, Record<string, unknown>>();

    sites.set("site-1", { id: "site-1", tenantId: "tenant-a", isActive: true, name: "Factory" });
    sites.set("site-b", { id: "site-b", tenantId: "tenant-b", isActive: true, name: "Other" });
    locations.set("loc-1", {
      id: "loc-1",
      tenantId: "tenant-a",
      siteId: "site-1",
      isActive: true,
      name: "Pump House",
      parentId: null,
      code: "PH",
      type: "AREA"
    });
    locations.set("loc-inactive", {
      id: "loc-inactive",
      tenantId: "tenant-a",
      siteId: "site-1",
      isActive: false,
      name: "Old",
      parentId: null,
      code: "OLD",
      type: "AREA"
    });
    assets.set("asset-1", {
      id: "asset-1",
      tenantId: "tenant-a",
      siteId: "site-1",
      functionalLocationId: "loc-1",
      status: AssetStatus.ACTIVE,
      archivedAt: null,
      parentAssetId: null,
      isActive: true
    });
    assets.set("child-1", {
      id: "child-1",
      tenantId: "tenant-a",
      siteId: "site-1",
      functionalLocationId: "loc-1",
      status: AssetStatus.ACTIVE,
      archivedAt: null,
      parentAssetId: "asset-1",
      isActive: true
    });
    vehicles.set("veh-1", {
      id: "veh-1",
      tenantId: "tenant-a",
      assetId: null,
      assetTag: null,
      registrationNo: "ABC-123"
    });

    return {
      site: {
        findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
          for (const site of sites.values()) {
            if (site.id === where.id && site.tenantId === where.tenantId) return site;
          }
          return null;
        })
      },
      functionalLocation: {
        findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
          for (const loc of locations.values()) {
            if (loc.id === where.id && loc.tenantId === where.tenantId) return loc;
          }
          return null;
        }),
        findMany: jest.fn(async ({ where }: { where: { tenantId: string } }) =>
          [...locations.values()].filter((l) => l.tenantId === where.tenantId)
        )
      },
      asset: {
        findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
          for (const asset of assets.values()) {
            if (where.id && asset.id === where.id && asset.tenantId === where.tenantId) return asset;
          }
          return null;
        }),
        findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
          [...assets.values()].filter((a) => {
            if (a.tenantId !== where.tenantId) return false;
            if (where.parentAssetId && a.parentAssetId !== where.parentAssetId) return false;
            return true;
          })
        ),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const existing = assets.get(where.id)!;
          const next = { ...existing, ...data };
          assets.set(where.id, next);
          return next;
        }),
        count: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
          [...assets.values()].filter((a) => {
            if (where.parentAssetId && a.parentAssetId !== where.parentAssetId) return false;
            if (where.isActive != null && a.isActive !== where.isActive) return false;
            return a.tenantId === where.tenantId || !where.tenantId;
          }).length
        )
      },
      assetLocationHistory: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: `hist-${histories.length + 1}`, ...data };
          histories.push(row);
          return row;
        }),
        findMany: jest.fn(async () => histories)
      },
      auditLog: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          audits.push(data);
          return data;
        })
      },
      workOrder: {
        count: jest.fn(async () => 0)
      },
      vehicle: {
        findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
          for (const v of vehicles.values()) {
            if (where.id && v.id === where.id && v.tenantId === where.tenantId) return v;
            if (where.assetId && v.assetId === where.assetId && v.id !== where.id) return v;
          }
          return null;
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const existing = vehicles.get(where.id)!;
          const next = { ...existing, ...data };
          vehicles.set(where.id, next);
          return next;
        }),
        count: jest.fn(async () => 0)
      },
      assetDomain: { findUnique: jest.fn(async () => null) },
      assetCategoryMaster: { findFirst: jest.fn(async () => null) },
      assetTypeMaster: { findFirst: jest.fn(async () => null) },
      assetAttributeDefinition: { findMany: jest.fn(async () => []) },
      department: { findFirst: jest.fn(async () => null) },
      _assets: assets,
      _histories: histories,
      _audits: audits
    };
  }

  it("moves asset with history and reason", async () => {
    const prisma = createRegistryPrisma();
    const service = new AssetRegistryService(prisma as never);
    (prisma as { functionalLocation: { findFirst: jest.Mock } }).functionalLocation.findFirst = jest.fn(
      async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id === "loc-2") {
          return {
            id: "loc-2",
            tenantId: "tenant-a",
            siteId: "site-1",
            isActive: true
          };
        }
        if (where.id === "loc-1") {
          return {
            id: "loc-1",
            tenantId: "tenant-a",
            siteId: "site-1",
            isActive: true
          };
        }
        return null;
      }
    );

    const result = await service.moveAsset("tenant-a", "asset-1", "user-1", {
      toSiteId: "site-1",
      toFunctionalLocationId: "loc-2",
      reason: "Production utility relocation"
    });
    expect(result.history.reason).toBe("Production utility relocation");
    expect(result.asset.functionalLocationId).toBe("loc-2");
    expect((prisma as { _audits: unknown[] })._audits.length).toBe(1);
  });

  it("blocks inactive destination", async () => {
    const prisma = createRegistryPrisma();
    const service = new AssetRegistryService(prisma as never);
    await expect(
      service.moveAsset("tenant-a", "asset-1", "user-1", {
        toSiteId: "site-1",
        toFunctionalLocationId: "loc-inactive",
        reason: "move"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks cross-tenant site", async () => {
    const prisma = createRegistryPrisma();
    const service = new AssetRegistryService(prisma as never);
    await expect(
      service.moveAsset("tenant-a", "asset-1", "user-1", {
        toSiteId: "site-b",
        toFunctionalLocationId: "loc-1",
        reason: "move"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks retirement when active children exist", async () => {
    const prisma = createRegistryPrisma();
    const service = new AssetRegistryService(prisma as never);
    await expect(
      service.retire("tenant-a", "asset-1", "user-1", { reason: "end of life" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("links vehicle to asset without destroying registration", async () => {
    const prisma = createRegistryPrisma();
    const service = new AssetRegistryService(prisma as never);
    prisma._assets.set("fleet-asset", {
      id: "fleet-asset",
      tenantId: "tenant-a",
      assetTag: "FLT-001",
      status: AssetStatus.ACTIVE
    });
    const linked = await service.linkVehicle("tenant-a", "veh-1", "fleet-asset", "user-1");
    expect(linked.assetId).toBe("fleet-asset");
    expect(linked.registrationNo).toBe("ABC-123");
  });
});

describe("phase 4 constants", () => {
  it("supports criticality and draft status enums", () => {
    expect(AssetCriticality.HIGH).toBe("HIGH");
    expect(AssetStatus.DRAFT).toBe("DRAFT");
    expect(AssetStatus.OUT_OF_SERVICE).toBe("OUT_OF_SERVICE");
    expect(AssetCondition.GOOD).toBe("GOOD");
  });
});
