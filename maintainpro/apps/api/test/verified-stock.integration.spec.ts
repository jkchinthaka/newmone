/**
 * Real SQL Server proof for verified stock issue allocation.
 * Refuses MaintainProDev and nelna.
 */
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";

import { assertVerifiedIssueAllowed } from "../src/modules/inventory/verified-stock-availability";

function databaseName(url: string): string {
  const match = url.match(/(?:database|initial catalog)\s*=\s*([^;]+)/i);
  return match?.[1]?.trim() ?? "";
}

const disposableUrl = process.env.DISPOSABLE_SQLSERVER_URL?.trim() ?? "";
const name = databaseName(disposableUrl);
const usable =
  name.startsWith("maintainpro_e2e_") &&
  !/nelna/i.test(disposableUrl) &&
  !/MaintainProDev/i.test(disposableUrl);
const describeIfDisposable = usable ? describe : describe.skip;

describeIfDisposable("verified stock issue on disposable SQL Server", () => {
  jest.setTimeout(60_000);
  const prisma = new PrismaClient({ datasources: { db: { url: disposableUrl } } });
  const stamp = Date.now();
  let tenantId = "";
  let partId = "";
  let warehouseId = "";

  beforeAll(async () => {
    await prisma.$connect();
    const tenant = await prisma.tenant.create({
      data: { name: "Verified stock", slug: `verified-stock-${stamp}` }
    });
    tenantId = tenant.id;
    const part = await prisma.sparePart.create({
      data: {
        tenantId,
        partNumber: `VS-${stamp}`,
        name: "Bearing",
        category: "SPARE",
        unitCost: 1,
        quantityInStock: 19
      }
    });
    partId = part.id;
    const warehouse = await prisma.warehouse.create({
      data: {
        tenantId,
        code: `MAIN-${stamp}`,
        name: "Main",
        erpWarehouseCode: "BILEETA-MAIN",
        lastErpValidatedAt: new Date("2026-10-01T00:00:00.000Z"),
        isDefault: true
      }
    });
    warehouseId = warehouse.id;
    await prisma.warehouseItemBalance.create({
      data: { tenantId, warehouseId, partId, onHand: 19, reserved: 0, available: 19 }
    });
  });

  afterAll(async () => {
    await prisma.domainEventOutbox.deleteMany({ where: { tenantId } });
    await prisma.warehouseItemBalance.deleteMany({ where: { tenantId } });
    await prisma.warehouse.deleteMany({ where: { tenantId } });
    await prisma.sparePart.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  async function issue(quantity: number) {
    return prisma.$transaction(
      async (tx) => {
        await assertVerifiedIssueAllowed(tx, { tenantId, partId, quantity, warehouseId });
        await tx.domainEventOutbox.create({
          data: {
            tenantId,
            eventId: `stock-proof:${randomUUID()}`,
            eventType: "WORK_ORDER_PART_CONSUMPTION",
            aggregateType: "SparePart",
            aggregateId: partId,
            payload: JSON.stringify({ partId, quantity, quantityInStockMutated: false })
          }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 }
    );
  }

  it("ST-08 two simultaneous issues of 12 against 19 cannot both succeed", async () => {
    const results = await Promise.allSettled([issue(12), issue(12)]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
    const outbox = await prisma.domainEventOutbox.count({ where: { tenantId, eventType: "WORK_ORDER_PART_CONSUMPTION" } });
    expect(outbox).toBe(1);
    const part = await prisma.sparePart.findUniqueOrThrow({ where: { id: partId } });
    const balance = await prisma.warehouseItemBalance.findFirstOrThrow({ where: { tenantId, partId } });
    expect(part.quantityInStock).toBe(19);
    expect(balance.onHand).toBe(19);
  });

  it("ST-17 ST-18 ST-19 excess issue writes nothing and a valid issue keeps the ERP snapshot", async () => {
    await expect(issue(500)).rejects.toThrow(/Insufficient verified stock/);
    const before = await prisma.domainEventOutbox.count({ where: { tenantId } });
    await issue(1);
    const after = await prisma.domainEventOutbox.count({ where: { tenantId } });
    expect(after).toBe(before + 1);
    const part = await prisma.sparePart.findUniqueOrThrow({ where: { id: partId } });
    expect(part.quantityInStock).toBe(19);
    const pending = await prisma.domainEventOutbox.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
    });
    expect(pending?.status).toBe("PENDING");
  });
});
