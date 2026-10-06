import { BadRequestException } from "@nestjs/common";
import { StockCountService } from "../src/modules/inventory/stock-count.service";

describe("stock count service", () => {
  const actor = {
    sub: "u1",
    tenantId: "t1",
    role: "ADMIN",
    permissions: ["inventory.manage"]
  };

  it("rejects illegal transitions", async () => {
    const prisma = {
      stockCountSession: {
        findFirst: jest.fn().mockResolvedValue({
          id: "s1",
          tenantId: "t1",
          status: "DRAFT",
          warehouseId: "w1"
        })
      }
    };
    const service = new StockCountService(prisma as never, {} as never);
    await expect(service.transition(actor as never, "s1", "POSTED")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("uses warehouse ledger on-hand as expected quantity, not ERP snapshot", async () => {
    const upsert = jest.fn().mockResolvedValue({
      id: "line1",
      expectedQuantity: 0,
      countedQuantity: 145,
      variance: 145
    });
    const prisma = {
      stockCountSession: {
        findFirst: jest.fn().mockResolvedValue({
          id: "s1",
          tenantId: "t1",
          status: "COUNTING",
          warehouseId: "w1"
        })
      },
      warehouseItemBalance: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      stockCountLine: { upsert }
    };
    const service = new StockCountService(prisma as never, {} as never);
    await service.upsertLine(actor as never, "s1", { partId: "p1", countedQuantity: 145 });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ expectedQuantity: 0, variance: 145 }),
        update: expect.objectContaining({ expectedQuantity: 0, variance: 145 })
      })
    );
  });

  it("requires approve before post from REVIEW", async () => {
    const prisma = {
      stockCountSession: {
        findFirst: jest.fn().mockResolvedValue({
          id: "s1",
          tenantId: "t1",
          status: "REVIEW",
          warehouseId: "w1",
          lines: []
        })
      }
    };
    const service = new StockCountService(prisma as never, {} as never);
    await expect(service.post(actor as never, "s1")).rejects.toBeInstanceOf(BadRequestException);
  });
});
