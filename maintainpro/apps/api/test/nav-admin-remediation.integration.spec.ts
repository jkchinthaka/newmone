/**
 * Disposable SQL Server proof for meter uniqueness, tag import, and QR identity.
 * Refuses MaintainProDev and nelna.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ConflictException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

import { AssetTagImportService } from "../src/modules/assets/asset-tag-import.service";
import { scannedValueMatchesAsset } from "../src/modules/evidence/scanned-identifier";
import { UtilitiesService } from "../src/modules/utilities/utilities.service";

function databaseName(url: string) {
  const match = url.match(/(?:database|initial catalog)\s*=\s*([^;]+)/i);
  return match?.[1]?.trim() ?? "";
}

const disposableUrl = process.env.DISPOSABLE_SQLSERVER_URL?.trim() ?? "";
const name = databaseName(disposableUrl);
const usable = name.startsWith("maintainpro_e2e_") && !/nelna/i.test(name) && !/MaintainProDev/i.test(name);
const describeIfDisposable = usable ? describe : describe.skip;

describeIfDisposable("navigation admin remediation on disposable SQL Server", () => {
  jest.setTimeout(90_000);
  const prisma = new PrismaClient({ datasources: { db: { url: disposableUrl } } });
  const readings = new UtilitiesService(prisma as never);
  const tags = new AssetTagImportService(prisma as never);
  const stamp = Date.now();
  let tenantId = "";
  let otherTenantId = "";
  let userId = "";
  let meterId = "";

  beforeAll(async () => {
    await prisma.$connect();
    const migration = readFileSync(
      join(__dirname, "../../../prisma/migrations/20261016093000_meter_reading_timestamp_unique/migration.sql"),
      "utf8"
    );
    for (const statement of migration.split(/^\s*GO\s*$/gim).map((part) => part.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(statement);
    }
    const tenant = await prisma.tenant.create({ data: { name: "Nav admin", slug: `nav-admin-${stamp}` } });
    const other = await prisma.tenant.create({ data: { name: "Nav other", slug: `nav-other-${stamp}` } });
    tenantId = tenant.id;
    otherTenantId = other.id;
    const role = await prisma.role.create({ data: { tenantId, name: "ADMIN" } });
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: `nav-admin-${stamp}@example.test`,
        passwordHash: "not-a-real-password",
        firstName: "Nav",
        lastName: "Admin",
        roleId: role.id
      }
    });
    userId = user.id;
    const meter = await prisma.utilityMeter.create({
      data: { tenantId, meterNumber: `M-${stamp}`, type: "WATER", location: "Plant", unit: "m3" }
    });
    meterId = meter.id;
    await prisma.asset.create({
      data: { tenantId, assetTag: `AST-OLD${String(stamp).slice(-4)}`, name: "Pump", category: "MACHINE", serialNumber: `SN-${stamp}` }
    });
    await prisma.asset.create({
      data: { tenantId: otherTenantId, assetTag: "AST-OTHER1", name: "Other pump", category: "MACHINE", serialNumber: `SN-${stamp}` }
    });
  });

  afterAll(async () => {
    await prisma.meterReading.deleteMany({ where: { meterId } }).catch(() => undefined);
    await prisma.utilityMeter.deleteMany({ where: { tenantId } }).catch(() => undefined);
    await prisma.asset.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("lets only one concurrent insert win for the same meter timestamp", async () => {
    const readingDate = "2026-10-16T02:00:00.000Z";
    const results = await Promise.allSettled([
      readings.addReading(meterId, tenantId, { readingDate, readingValue: 10, idempotencyKey: `same-${stamp}` }),
      readings.addReading(meterId, tenantId, { readingDate, readingValue: 10, idempotencyKey: `same-${stamp}` })
    ]);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
    if (rejected) throw rejected.reason;
    expect(results).toHaveLength(2);
    const rows = await prisma.meterReading.count({ where: { meterId, readingDate: new Date(readingDate) } });
    expect(rows).toBe(1);
  });

  it("rejects a conflicting reuse of the same idempotency key", async () => {
    await expect(
      readings.addReading(meterId, tenantId, {
        readingDate: "2026-10-16T03:00:00.000Z",
        readingValue: 99,
        idempotencyKey: `same-${stamp}`
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a second different reading at an existing timestamp", async () => {
    const readingDate = "2026-10-16T02:00:00.000Z";
    await expect(
      readings.addReading(meterId, tenantId, { readingDate, readingValue: 11, idempotencyKey: `other-${stamp}` })
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await prisma.meterReading.count({ where: { meterId } })).toBe(1);
  });

  it("previews and applies a CSV tag, blocks replacement without a reason, and denies another tenant", async () => {
    const asset = await prisma.asset.findFirstOrThrow({ where: { tenantId, serialNumber: `SN-${stamp}` } });
    const csv = Buffer.from(`assetTag,serialNumber\nAST-NEW${String(stamp).slice(-4)},SN-${stamp}\n`);
    const preview = await tags.preview(tenantId, { originalname: "tags.csv", buffer: csv });
    expect(preview[0]?.action).toBe("replace");
    await expect(tags.apply(tenantId, userId, { originalname: "tags.csv", buffer: csv }, {})).rejects.toThrow(/Allow replace/);
    const applied = await tags.apply(tenantId, userId, { originalname: "tags.csv", buffer: csv }, {
      allowReplace: true,
      replaceReason: "Retag after audit"
    });
    expect(applied.applied[0]?.assetTag).toContain("AST-NEW");
    const updated = await prisma.asset.findFirstOrThrow({ where: { id: asset.id } });
    expect(updated.name).toBe("Pump");
    const audit = await prisma.auditLog.findFirst({ where: { tenantId, entityId: asset.id, action: "UPDATE" } });
    expect(audit?.beforeData).toContain("AST-OLD");
    const foreign = await tags.preview(tenantId, {
      originalname: "foreign.csv",
      buffer: Buffer.from("assetTag,serialNumber\nAST-ZZZZ,SN-DOES-NOT-EXIST\n")
    });
    expect(foreign[0]?.status).toBe("invalid");
    const cross = await scannedValueMatchesAsset(prisma as never, tenantId, asset.id, "AST-OTHER1");
    expect(cross).toBe(false);
    const own = await scannedValueMatchesAsset(prisma as never, tenantId, asset.id, updated.assetTag);
    expect(own).toBe(true);
  });

  it("reads an XLSX tag file and rolls back when the audit actor does not exist", async () => {
    const asset = await prisma.asset.findFirstOrThrow({ where: { tenantId, serialNumber: `SN-${stamp}` } });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("tags");
    sheet.addRow(["assetTag", "serialNumber"]);
    sheet.addRow(["AST-ROLL1", `SN-${stamp}`]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const before = asset.assetTag;
    await expect(
      tags.apply(tenantId, "missing-user", { originalname: "tags.xlsx", buffer }, { allowReplace: true, replaceReason: "Should roll back" })
    ).rejects.toThrow();
    const after = await prisma.asset.findFirstOrThrow({ where: { id: asset.id } });
    expect(after.assetTag).toBe(before);
  });
});
