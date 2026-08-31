import { PartRequestStatus, RoleName } from "@prisma/client";

import { InventoryService } from "../src/modules/inventory/inventory.service";
import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";

describe("inventory read gap endpoints", () => {
  const actor = {
    sub: "user-1",
    email: "keeper@maintainpro.local",
    role: RoleName.INVENTORY_KEEPER,
    tenantId: "tenant-1"
  };

  it("lists part requests globally with tenant scope and pagination", async () => {
    const prisma = {
      partRequest: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([{ id: "pr-1", tenantId: "tenant-1" }])
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops))
    };

    const service = new WorkOrdersService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );

    const result = await service.listAllPartRequests(actor, {
      status: PartRequestStatus.PENDING_OPERATIONAL,
      page: "1",
      limit: "20"
    });

    expect(prisma.partRequest.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          status: PartRequestStatus.PENDING_OPERATIONAL
        })
      })
    );
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it("lists warehouse balances with tenant scope and pagination", async () => {
    const prisma = {
      warehouseItemBalance: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([
          { id: "bal-1", tenantId: "tenant-1", onHand: 5 },
          { id: "bal-2", tenantId: "tenant-1", onHand: 0 }
        ])
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops))
    };

    const service = new InventoryService(
      prisma as never,
      {} as never,
      {} as never
    );

    const result = await service.listWarehouseBalances(actor, {
      warehouseId: "wh-1",
      nonZeroOnly: "true",
      page: "1",
      limit: "50"
    });

    expect(prisma.warehouseItemBalance.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          warehouseId: "wh-1"
        })
      })
    );
    expect(result.items).toHaveLength(2);
    expect(result.meta.page).toBe(1);
  });
});
