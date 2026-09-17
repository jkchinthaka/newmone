import { PrismaClient } from "@prisma/client";

/**
 * Unicode round-trip for Sinhala/Tamil labels on SQL Server NVARCHAR storage.
 */
describe("SQL Server unicode persistence", () => {
  const hasDb = Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("<"));
  const prisma = hasDb ? new PrismaClient() : null;

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  (hasDb ? it : it.skip)("persists Sinhala and Tamil in Asset.name", async () => {
    const tenant = await prisma!.tenant.findFirst({ select: { id: true } });
    if (!tenant) {
      console.warn("No tenant — skip unicode insert");
      return;
    }
    const name = "පරීක්ෂණ යන්ත්‍රம் / சோதனை இயந்திரம்";
    const tag = `UNI-${Date.now().toString(36)}`;
    const created = await prisma!.asset.create({
      data: {
        tenantId: tenant.id,
        assetTag: tag,
        name,
        category: "EQUIPMENT",
        status: "ACTIVE",
        condition: "GOOD"
      },
      select: { id: true, name: true }
    });
    expect(created.name).toBe(name);
    const reloaded = await prisma!.asset.findFirst({
      where: { id: created.id, tenantId: tenant.id },
      select: { name: true }
    });
    expect(reloaded?.name).toBe(name);
    await prisma!.asset.delete({ where: { id: created.id } });
  });
});
