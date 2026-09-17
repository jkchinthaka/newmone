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
