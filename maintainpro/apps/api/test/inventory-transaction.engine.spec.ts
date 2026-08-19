import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { InventoryTransactionEngine } from "../src/modules/inventory/inventory-transaction.engine";
import { hashIdempotencyPayload } from "../src/modules/inventory/inventory-invariants";

type Balance = { id: string; tenantId: string; warehouseId: string; partId: string; onHand: number; reserved: number; available: number };

function createHarness() {
  const warehouses = [
    { id: "wh-1", tenantId: "t1", code: "DEFAULT", name: "Default Warehouse", isDefault: true, isActive: true },
    { id: "wh-2", tenantId: "t1", code: "SECOND", name: "Second", isDefault: false, isActive: true }
  ];
  const parts = new Map([
    [
      "part-1",
      {
        id: "part-1",
        tenantId: "t1",
        isActive: true,
        quantityInStock: 20,
        reservedQuantity: 0,
        availableQuantity: 20
      }
    ]
  ]);
  const balances = new Map<string, Balance>([
    ["t1:wh-1:part-1", { id: "bal-1", tenantId: "t1", warehouseId: "wh-1", partId: "part-1", onHand: 20, reserved: 0, available: 20 }]
  ]);
  const movements: Array<Record<string, unknown>> = [];
  const idempotency = new Map<string, Record<string, unknown>>();
  const audits: unknown[] = [];

  const tx = {
    warehouse: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        warehouses.find((row) => {
          if (row.tenantId !== where.tenantId) return false;
          if (where.id && row.id !== where.id) return false;
          if (where.code && row.code !== where.code) return false;
          if (where.isDefault && !row.isDefault) return false;
          if (where.isActive && !row.isActive) return false;
          return true;
        }) ?? null,
      create: async ({ data }: { data: (typeof warehouses)[number] }) => {
        warehouses.push(data);
        return data;
      }
    },
    sparePart: {
      findFirst: async ({ where }: { where: { id: string } }) => parts.get(where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, number> }) => {
        const part = parts.get(where.id)!;
        Object.assign(part, data);
        return part;
      }
    },
    warehouseItemBalance: {
      findFirst: async ({ where }: { where: { tenantId: string; warehouseId: string; partId: string } }) =>
        balances.get(`${where.tenantId}:${where.warehouseId}:${where.partId}`) ?? null,
      findMany: async ({ where }: { where: { tenantId: string; partId: string } }) =>
        Array.from(balances.values()).filter((row) => row.tenantId === where.tenantId && row.partId === where.partId),
      create: async ({ data }: { data: Balance }) => {
        balances.set(`${data.tenantId}:${data.warehouseId}:${data.partId}`, data);
        return data;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Balance> }) => {
        const row = Array.from(balances.values()).find((item) => item.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({
        where,
        data
      }: {
        where: { tenantId: string; warehouseId: string; partId: string; onHand?: { gte: number }; reserved?: { gte: number }; available?: { gte: number } };
        data: { onHand?: { increment: number }; reserved?: { increment: number }; available?: { increment: number } };
      }) => {
        const key = `${where.tenantId}:${where.warehouseId}:${where.partId}`;
        const row = balances.get(key);
        if (!row) return { count: 0 };
        if (where.onHand && row.onHand < where.onHand.gte) return { count: 0 };
        if (where.reserved && row.reserved < where.reserved.gte) return { count: 0 };
        if (where.available && row.available < where.available.gte) return { count: 0 };
        row.onHand += data.onHand?.increment ?? 0;
        row.reserved += data.reserved?.increment ?? 0;
        row.available += data.available?.increment ?? 0;
        return { count: 1 };
      }
    },
    stockMovement: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const created = { id: `mov-${movements.length + 1}`, quantityReversed: 0, ...data };
        movements.push(created);
        return created;
      },
      findFirst: async ({ where }: { where: { id?: string; tenantId?: string } }) =>
        movements.find((row) => (!where.id || row.id === where.id) && (!where.tenantId || row.tenantId === where.tenantId)) ?? null,
      updateMany: async ({ where, data }: { where: { id: string }; data: { quantityReversed: { increment: number } } }) => {
        const row = movements.find((item) => item.id === where.id) as { quantityReversed: number } | undefined;
        if (!row) return { count: 0 };
        row.quantityReversed += data.quantityReversed.increment;
        return { count: 1 };
      }
    },
    inventoryIdempotency: {
      findUnique: async ({ where }: { where: { tenantId_key: { tenantId: string; key: string } } }) =>
        idempotency.get(`${where.tenantId_key.tenantId}:${where.tenantId_key.key}`) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const key = `${data.tenantId}:${data.key}`;
        if (idempotency.has(key)) {
          const error = new Error("Unique constraint failed") as Error & { code: string };
          error.code = "P2002";
          Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);
          throw error;
        }
        idempotency.set(key, data);
        return data;
      },
      update: async ({
        where,
        data
      }: {
        where: { tenantId_key: { tenantId: string; key: string } };
        data: Record<string, unknown>;
      }) => {
        const key = `${where.tenantId_key.tenantId}:${where.tenantId_key.key}`;
        const row = idempotency.get(key);
        if (!row) {
          throw new Error("Idempotency record not found");
        }
        Object.assign(row, data);
        return row;
      }
    },
    auditLog: {
      create: async ({ data }: { data: unknown }) => {
        audits.push(data);
        return data;
      }
    }
  };

  const prisma = {
    ...tx,
    $transaction: async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)
  };

  const engine = new InventoryTransactionEngine(prisma as never);
  const actor = { sub: "u1", email: "u1@test.com", role: "ADMIN" as const, tenantId: "t1" };
  return { engine, actor, parts, balances, movements, idempotency };
}

describe("InventoryTransactionEngine", () => {
  it("rejects reservation larger than available", async () => {
    const { engine, actor, balances } = createHarness();
    await engine.reserve({ actor, partId: "part-1", quantity: 12 });
    await expect(engine.reserve({ actor, partId: "part-1", quantity: 10 })).rejects.toBeInstanceOf(BadRequestException);
    expect(balances.get("t1:wh-1:part-1")).toMatchObject({ onHand: 20, reserved: 12, available: 8 });
  });

  it("prevents two concurrent reservations from taking the last units", async () => {
    const { engine, actor, balances } = createHarness();
    const results = await Promise.allSettled([
      engine.reserve({ actor, partId: "part-1", quantity: 12 }),
      engine.reserve({ actor, partId: "part-1", quantity: 12 })
    ]);
    const fulfilled = results.filter((row) => row.status === "fulfilled");
    const rejected = results.filter((row) => row.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(balances.get("t1:wh-1:part-1")?.reserved).toBe(12);
  });

  it("issues from reservation without double-decrementing available", async () => {
    const { engine, actor, balances } = createHarness();
    await engine.reserve({ actor, partId: "part-1", quantity: 5 });
    await engine.issue({ actor, partId: "part-1", quantity: 5, consumeReservation: true, workOrderId: "wo-1" });
    expect(balances.get("t1:wh-1:part-1")).toMatchObject({ onHand: 15, reserved: 0, available: 15 });
  });

  it("returns unused stock and records a RETURN movement", async () => {
    const { engine, actor, movements } = createHarness();
    await engine.issue({ actor, partId: "part-1", quantity: 4, workOrderId: "wo-1" });
    await engine.returnStock({ actor, partId: "part-1", quantity: 2, workOrderId: "wo-1" });
    expect(movements.some((row) => row.type === "RETURN")).toBe(true);
  });

  it("transfers atomically between warehouses", async () => {
    const { engine, actor, balances } = createHarness();
    balances.set("t1:wh-2:part-1", {
      id: "bal-2",
      tenantId: "t1",
      warehouseId: "wh-2",
      partId: "part-1",
      onHand: 0,
      reserved: 0,
      available: 0
    });
    await engine.transfer({
      actor,
      partId: "part-1",
      quantity: 3,
      warehouseId: "wh-1",
      destWarehouseId: "wh-2"
    });
    expect(balances.get("t1:wh-1:part-1")?.onHand).toBe(17);
    expect(balances.get("t1:wh-2:part-1")?.onHand).toBe(3);
  });

  it("rejects negative adjustments that would breach available stock", async () => {
    const { engine, actor } = createHarness();
    await expect(engine.adjust({ actor, partId: "part-1", quantity: 50, direction: "OUT", reason: "cycle count" })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("reverses an inbound movement with linkage and blocks a second reversal of the same qty", async () => {
    const { engine, actor, movements } = createHarness();
    const received = await engine.receive({ actor, partId: "part-1", quantity: 2, notes: "grn" });
    await engine.reverse({
      actor,
      partId: "part-1",
      quantity: 2,
      reason: "posted in error",
      reversalOfMovementId: received.movement.id
    });
    expect(movements.some((row) => row.type === "REVERSAL")).toBe(true);
    await expect(
      engine.reverse({
        actor,
        partId: "part-1",
        quantity: 2,
        reason: "posted in error again",
        reversalOfMovementId: received.movement.id
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("replays the same idempotency key and rejects a mismatched payload", async () => {
    const { engine, actor, parts } = createHarness();
    await engine.receive({ actor, partId: "part-1", quantity: 5, idempotencyKey: "k1" });
    const replay = await engine.receive({ actor, partId: "part-1", quantity: 5, idempotencyKey: "k1" });
    expect(replay.replayed).toBe(true);
    expect(parts.get("part-1")?.quantityInStock).toBe(25);
    await expect(engine.receive({ actor, partId: "part-1", quantity: 9, idempotencyKey: "k1" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects same key with a different item after the first write", async () => {
    const { engine, actor } = createHarness();
    await engine.receive({ actor, partId: "part-1", quantity: 1, idempotencyKey: "k2" });
    await expect(engine.receive({ actor, partId: "missing", quantity: 1, idempotencyKey: "k2" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("P2002 race revalidates payload before success", async () => {
    const { engine, actor, parts } = createHarness();
    const results = await Promise.allSettled([
      engine.receive({ actor, partId: "part-1", quantity: 5, idempotencyKey: "race-1" }),
      engine.receive({ actor, partId: "part-1", quantity: 9, idempotencyKey: "race-1" })
    ]);
    const fulfilled = results.filter((row) => row.status === "fulfilled");
    const rejected = results.filter((row) => row.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect([25, 29]).toContain(parts.get("part-1")?.quantityInStock);
    expect(
      hashIdempotencyPayload({
        operation: "receive",
        partId: "part-1",
        quantity: 5,
        warehouseId: null,
        warehouseCode: null,
        destWarehouseId: null,
        destWarehouseCode: null,
        workOrderId: null,
        consumeReservation: false,
        sourceLineKey: null,
        reversalOfMovementId: null
      })
    ).not.toBe(
      hashIdempotencyPayload({
        operation: "receive",
        partId: "part-1",
        quantity: 9,
        warehouseId: null,
        warehouseCode: null,
        destWarehouseId: null,
        destWarehouseCode: null,
        workOrderId: null,
        consumeReservation: false,
        sourceLineKey: null,
        reversalOfMovementId: null
      })
    );
  });
});
