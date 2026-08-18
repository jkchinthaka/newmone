import { InventoryDailyService } from "../src/modules/inventory/inventory-daily.service";

describe("inventory daily ledger", () => {
  it("reconciles opening + in + return + adj in - out - transfer out - adj out = closing", async () => {
    const prisma = {
      stockMovement: {
        findMany: jest.fn().mockResolvedValue([
          {
            partId: "p1",
            warehouseId: "w1",
            type: "IN",
            quantity: 10,
            createdAt: new Date("2026-08-17T10:00:00.000Z"),
            part: { id: "p1", partNumber: "A", name: "A", category: "GEN", unit: "pcs" },
            warehouse: { id: "w1", code: "MAIN", name: "Main" }
          },
          {
            partId: "p1",
            warehouseId: "w1",
            type: "OUT",
            quantity: 3,
            createdAt: new Date("2026-08-18T10:00:00.000Z"),
            part: { id: "p1", partNumber: "A", name: "A", category: "GEN", unit: "pcs" },
            warehouse: { id: "w1", code: "MAIN", name: "Main" }
          },
          {
            partId: "p1",
            warehouseId: "w1",
            type: "RETURN",
            quantity: 1,
            createdAt: new Date("2026-08-18T11:00:00.000Z"),
            part: { id: "p1", partNumber: "A", name: "A", category: "GEN", unit: "pcs" },
            warehouse: { id: "w1", code: "MAIN", name: "Main" }
          }
        ])
      }
    };
    const service = new InventoryDailyService(prisma as never);
    const result = await service.report(
      { from: "2026-08-18T00:00:00.000Z", to: "2026-08-19T00:00:00.000Z", preset: "custom" },
      { tenantId: "t1" }
    );
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.opening).toBe(10);
    expect(row.outbound).toBe(3);
    expect(row.returned).toBe(1);
    expect(row.closing).toBe(8);
  });
});
