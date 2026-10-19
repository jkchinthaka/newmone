/**
 * SQL Server proof for requester machine lookup.
 * Refuses nelna and MaintainProDev.
 */
import { PrismaClient, AssetStatus } from "@prisma/client";

import { MaintenanceRequestsService } from "../src/modules/maintenance-requests/maintenance-requests.service";

function databaseName(url: string): string {
  const match = url.match(/(?:database|initial catalog)\s*=\s*([^;]+)/i);
  return match?.[1]?.trim() ?? "";
}

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const name = databaseName(databaseUrl);
if (/nelna|MaintainProDev/i.test(databaseUrl)) {
  throw new Error(`Refusing machine lookup tests against shared database ${name || databaseUrl}`);
}
const usable = Boolean(databaseUrl) && name.startsWith("maintainpro_e2e_");
const describeIfDb = usable ? describe : describe.skip;

describeIfDb("machine lookup on disposable SQL Server", () => {
  jest.setTimeout(60_000);
  const prisma = new PrismaClient();
  const requests = new MaintenanceRequestsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never
  );
  const stamp = Date.now();
  let tenantId = "";
  let otherTenantId = "";

  beforeAll(async () => {
    await prisma.$connect();
    const tenant = await prisma.tenant.create({
      data: { name: "Machine search", slug: `mach-search-${stamp}` }
    });
    tenantId = tenant.id;
    const other = await prisma.tenant.create({
      data: { name: "Other tenant", slug: `mach-other-${stamp}` }
    });
    otherTenantId = other.id;
    const site = await prisma.site.create({
      data: { tenantId, code: "FARM02", name: "Farm 02", type: "FARM" }
    });
    const location = await prisma.functionalLocation.create({
      data: {
        tenantId,
        siteId: site.id,
        code: "PUMP",
        name: "Pump House",
        type: "AREA"
      }
    });
    await prisma.asset.create({
      data: {
        tenantId,
        assetTag: "AST-00254",
        name: "Industrial Water Pump",
        category: "MACHINERY",
        status: AssetStatus.ACTIVE,
        serialNumber: "SN-2026-00458",
        siteId: site.id,
        functionalLocationId: location.id,
        isActive: true
      }
    });
    await prisma.asset.create({
      data: {
        tenantId,
        assetTag: "AST-RETIRED",
        name: "Retired Pump",
        category: "MACHINERY",
        status: AssetStatus.RETIRED,
        serialNumber: "SN-2026-00458-OLD",
        isActive: true
      }
    });
    await prisma.asset.create({
      data: {
        tenantId: otherTenantId,
        assetTag: "AST-00254",
        name: "Industrial Water Pump",
        category: "MACHINERY",
        status: AssetStatus.ACTIVE,
        serialNumber: "SN-2026-00458",
        isActive: true
      }
    });
  });

  afterAll(async () => {
    await prisma.asset.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
    await prisma.functionalLocation.deleteMany({ where: { tenantId } });
    await prisma.site.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    await prisma.$disconnect();
  });

  it("matches tag, name, and serial fragments without returning hidden assets", async () => {
    for (const query of ["AST-00254", "ast-002", "Industrial", "water pump", "SN-2026-00458", "sn", "2026", "00458", "SN-2026", "  SN-2026-00458  "]) {
      const rows = await requests.lookupSelectableAssets(tenantId, query, 15);
      expect(rows.map((row) => row.assetTag)).toEqual(["AST-00254"]);
      expect(rows[0]?.serialNumber).toBe("SN-2026-00458");
      expect(rows[0]?.locationName).toBe("Pump House");
      expect(rows[0]).not.toHaveProperty("purchasePrice");
    }

    const other = await requests.lookupSelectableAssets(otherTenantId, "SN-2026-00458", 15);
    expect(other.map((row) => row.assetTag)).toEqual(["AST-00254"]);
    expect(other[0]?.siteName).toBeNull();

    const home = await requests.lookupSelectableAssets(tenantId, "AST-RETIRED", 15);
    expect(home).toEqual([]);
  });
});
