import { execSync } from "node:child_process";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

import { InventoryDailyService } from "../src/modules/inventory/inventory-daily.service";
import { InventoryTransactionEngine } from "../src/modules/inventory/inventory-transaction.engine";

/**
 * Real Prisma + disposable Mongo checks. Skipped unless DISPOSABLE_MONGO_URL is set.
 * Never point this at production Atlas.
 */
const uri = process.env.DISPOSABLE_MONGO_URL?.trim() || "";
const describeDisposable = uri ? describe : describe.skip;

describeDisposable("inventory disposable Mongo validation", () => {
  let prisma: PrismaClient;
  let engine: InventoryTransactionEngine;
  let tenantId: string;
  let partId: string;
  let warehouseA: string;
  let warehouseB: string;
  const actor = () => ({
    sub: "507f1f77bcf86cd799439011",
    email: "inv-gate@example.test",
    role: "ADMIN" as const,
    tenantId
  });

  beforeAll(async () => {
    if (/atlas|mongodb\.net|nelna\.prod|production/i.test(uri)) {
      throw new Error("Refusing to run disposable validation against a production-like Mongo URL");
    }
    process.env.DATABASE_URL = uri;
    process.env.PRIMARY_DATABASE_URL = uri;
    const root = join(__dirname, "../../..");
    execSync("npx prisma validate --schema ./prisma/schema.prisma", { cwd: root, stdio: "inherit", env: process.env });
    execSync("npx prisma generate --schema ./prisma/schema.prisma", { cwd: root, stdio: "inherit", env: process.env });
    execSync("npx prisma db push --schema ./prisma/schema.prisma --accept-data-loss --skip-generate", {
      cwd: root,
      stdio: "inherit",
      env: process.env
    });
    prisma = new PrismaClient({ datasources: { db: { url: uri } } });
    await prisma.$connect();
    engine = new InventoryTransactionEngine(prisma as never);

    const stamp = Date.now().toString(36);
    const tenant = await prisma.tenant.create({
      data: { name: `Inv Gate ${stamp}`, slug: `inv-gate-${stamp}` }
    });
    tenantId = tenant.id;
    const part = await prisma.sparePart.create({
      data: {
        tenantId,
        partNumber: `INV-GATE-${stamp}`,
        name: "Disposable validation part",
        category: "TEST",
        unit: "pcs",
        unitCost: 1
      }
    });
    partId = part.id;
    const [whA, whB] = await Promise.all([
      prisma.warehouse.create({
        data: { tenantId, code: "WH-A", name: "Warehouse A", isDefault: true, isActive: true }
      }),
      prisma.warehouse.create({
        data: { tenantId, code: "WH-B", name: "Warehouse B", isDefault: false, isActive: true }
      })
    ]);
    warehouseA = whA.id;
    warehouseB = whB.id;
  }, 180000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("enforces warehouse/item balance uniqueness", async () => {
    const part = await prisma.sparePart.create({
      data: {
        tenantId,
        partNumber: `INV-UNIQ-${Date.now()}`,
        name: "Uniq part",
        category: "TEST",
        unit: "pcs",
        unitCost: 1
      }
    });
    await prisma.warehouseItemBalance.create({
      data: { tenantId, warehouseId: warehouseA, partId: part.id, onHand: 0, reserved: 0, available: 0 }
    });
    await expect(
      prisma.warehouseItemBalance.create({
        data: { tenantId, warehouseId: warehouseA, partId: part.id, onHand: 1, reserved: 0, available: 1 }
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("receives stock then reserves without exceeding available", async () => {
    await engine.receive({ actor: actor(), partId, quantity: 20, warehouseId: warehouseA });
    const reserved = await engine.reserve({
      actor: actor(),
      partId,
      quantity: 5,
      warehouseId: warehouseA,
      workOrderId: undefined,
      sourceType: "WO_RESERVATION",
      sourceLineKey: "wo-res:disposable-1",
      idempotencyKey: "wo-res:disposable-1"
    });
    expect(reserved.part.reservedQuantity).toBeGreaterThanOrEqual(5);
    await expect(
      engine.reserve({ actor: actor(), partId, quantity: 100, warehouseId: warehouseA })
    ).rejects.toBeTruthy();
  });

  it("rejects concurrent reservations that would oversubscribe available stock", async () => {
    const part = await prisma.sparePart.create({
      data: {
        tenantId,
        partNumber: `INV-CONC-RES-${Date.now()}`,
        name: "Conc reserve",
        category: "TEST",
        unit: "pcs",
        unitCost: 1
      }
    });
    await engine.receive({ actor: actor(), partId: part.id, quantity: 10, warehouseId: warehouseA });
    const results = await Promise.allSettled([
      engine.reserve({ actor: actor(), partId: part.id, quantity: 8, warehouseId: warehouseA }),
      engine.reserve({ actor: actor(), partId: part.id, quantity: 8, warehouseId: warehouseA })
    ]);
    expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((row) => row.status === "rejected")).toHaveLength(1);
  });

  it("rejects concurrent issues that would drive stock negative", async () => {
    const part = await prisma.sparePart.create({
      data: {
        tenantId,
        partNumber: `INV-CONC-ISSUE-${Date.now()}`,
        name: "Conc issue",
        category: "TEST",
        unit: "pcs",
        unitCost: 1
      }
    });
    await engine.receive({ actor: actor(), partId: part.id, quantity: 10, warehouseId: warehouseA });
    const results = await Promise.allSettled([
      engine.issue({ actor: actor(), partId: part.id, quantity: 8, warehouseId: warehouseA }),
      engine.issue({ actor: actor(), partId: part.id, quantity: 8, warehouseId: warehouseA })
    ]);
    expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((row) => row.status === "rejected")).toHaveLength(1);
  });

  it("transfers atomically between warehouses", async () => {
    const part = await prisma.sparePart.create({
      data: {
        tenantId,
        partNumber: `INV-XFER-${Date.now()}`,
        name: "Transfer part",
        category: "TEST",
        unit: "pcs",
        unitCost: 1
      }
    });
    await engine.receive({ actor: actor(), partId: part.id, quantity: 10, warehouseId: warehouseA });
    await engine.transfer({
      actor: actor(),
      partId: part.id,
      quantity: 4,
      warehouseId: warehouseA,
      destWarehouseId: warehouseB
    });
    const [fromBal, toBal] = await Promise.all([
      prisma.warehouseItemBalance.findFirst({ where: { tenantId, warehouseId: warehouseA, partId: part.id } }),
      prisma.warehouseItemBalance.findFirst({ where: { tenantId, warehouseId: warehouseB, partId: part.id } })
    ]);
    expect(fromBal?.onHand).toBe(6);
    expect(toBal?.onHand).toBe(4);
  });

  it("replays the same idempotency key and rejects a different payload", async () => {
    const part = await prisma.sparePart.create({
      data: {
        tenantId,
        partNumber: `INV-IDEM-${Date.now()}`,
        name: "Idem part",
        category: "TEST",
        unit: "pcs",
        unitCost: 1
      }
    });
    const key = `idem-${Date.now()}`;
    await engine.receive({ actor: actor(), partId: part.id, quantity: 3, warehouseId: warehouseA, idempotencyKey: key });
    const replay = await engine.receive({
      actor: actor(),
      partId: part.id,
      quantity: 3,
      warehouseId: warehouseA,
      idempotencyKey: key
    });
    expect(replay.replayed).toBe(true);
    await expect(
      engine.receive({ actor: actor(), partId: part.id, quantity: 9, warehouseId: warehouseA, idempotencyKey: key })
    ).rejects.toBeTruthy();
    const after = await prisma.sparePart.findFirst({ where: { id: part.id } });
    expect(after?.quantityInStock).toBe(3);
  });

  it("treats concurrent duplicate import keys as one mutation", async () => {
    const part = await prisma.sparePart.create({
      data: {
        tenantId,
        partNumber: `INV-IMP-${Date.now()}`,
        name: "Import part",
        category: "TEST",
        unit: "pcs",
        unitCost: 1
      }
    });
    const key = `import:LINE-${Date.now()}`;
    const results = await Promise.allSettled([
      engine.receive({
        actor: actor(),
        partId: part.id,
        quantity: 2,
        warehouseId: warehouseA,
        idempotencyKey: key,
        sourceLineKey: key
      }),
      engine.receive({
        actor: actor(),
        partId: part.id,
        quantity: 2,
        warehouseId: warehouseA,
        idempotencyKey: key,
        sourceLineKey: key
      })
    ]);
    const fulfilled = results.filter((row) => row.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    const after = await prisma.sparePart.findFirst({ where: { id: part.id } });
    expect(after?.quantityInStock).toBe(2);
  });

  it("links a reversal and blocks a second reversal of the same quantity", async () => {
    const part = await prisma.sparePart.create({
      data: {
        tenantId,
        partNumber: `INV-REV-${Date.now()}`,
        name: "Reversal part",
        category: "TEST",
        unit: "pcs",
        unitCost: 1
      }
    });
    const received = await engine.receive({ actor: actor(), partId: part.id, quantity: 5, warehouseId: warehouseA });
    const reversal = await engine.reverse({
      actor: actor(),
      partId: part.id,
      quantity: 5,
      warehouseId: warehouseA,
      reason: "posted in error",
      reversalOfMovementId: received.movement.id
    });
    expect(reversal.movement.id).toBeTruthy();
    const original = await prisma.stockMovement.findFirst({ where: { id: received.movement.id } });
    expect(original?.quantityReversed).toBe(5);
    await expect(
      engine.reverse({
        actor: actor(),
        partId: part.id,
        quantity: 5,
        warehouseId: warehouseA,
        reason: "second reversal",
        reversalOfMovementId: received.movement.id
      })
    ).rejects.toBeTruthy();
  });

  it("aggregates daily inventory from ledger movements", async () => {
    const part = await prisma.sparePart.create({
      data: {
        tenantId,
        partNumber: `INV-DAY-${Date.now()}`,
        name: "Daily part",
        category: "TEST",
        unit: "pcs",
        unitCost: 1
      }
    });
    await engine.receive({ actor: actor(), partId: part.id, quantity: 10, warehouseId: warehouseA });
    await engine.issue({ actor: actor(), partId: part.id, quantity: 3, warehouseId: warehouseA });
    const daily = new InventoryDailyService(prisma as never);
    const report = await daily.report({ preset: "today", partId: part.id }, { tenantId });
    expect(report.rows.length).toBeGreaterThanOrEqual(1);
    const row = report.rows.find((item) => item.partId === part.id);
    expect(row?.inbound).toBe(10);
    expect(row?.outbound).toBe(3);
    expect(row?.closing).toBe(7);
  });

  it("exposes unique indexes used by the engine", async () => {
    const indexes = await prisma.$runCommandRaw({
      listIndexes: "WarehouseItemBalance"
    });
    expect(JSON.stringify(indexes)).toMatch(/tenantId/i);
  });
});
