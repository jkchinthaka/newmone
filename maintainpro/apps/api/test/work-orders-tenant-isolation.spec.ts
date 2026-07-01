import { NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";
import { createWorkOrderPartsServiceMock } from "./helpers/work-order-parts-service.mock";
import { createWorkOrderTaxonomyServiceMock } from "./helpers/work-order-taxonomy-service.mock";

const createPrismaMock = () => ({
  workOrder: {
    findFirst: jest.fn(),
    update: jest.fn()
  },
  user: {
    findFirst: jest.fn()
  },
  auditLog: {
    create: jest.fn()
  }
});

describe("WorkOrdersService tenant isolation", () => {
  const actor = {
    sub: "actor-1",
    email: "actor@example.com",
    role: RoleName.ADMIN,
    tenantId: "tenant-a"
  };

  it("assign verifies work order tenant ownership before update", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst.mockResolvedValue(null);
    const notificationsService = { createNotification: jest.fn() };
    const service = new WorkOrdersService(prisma as any, notificationsService as any, createWorkOrderPartsServiceMock() as any, createWorkOrderTaxonomyServiceMock() as any);

    await expect(service.assign("wo-1", "tech-1", actor)).rejects.toThrow(NotFoundException);
    expect(prisma.workOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wo-1", tenantId: "tenant-a" }
      })
    );
    expect(prisma.workOrder.update).not.toHaveBeenCalled();
  });

  it("assign scopes technician lookup to tenant context", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst.mockResolvedValue({
      id: "wo-1",
      woNumber: "WO-2026-0001",
      dueDate: null,
      status: "OPEN"
    });
    prisma.user.findFirst.mockResolvedValue({
      id: "tech-1",
      role: { name: RoleName.TECHNICIAN }
    });
    prisma.workOrder.update.mockResolvedValue({
      id: "wo-1",
      woNumber: "WO-2026-0001",
      dueDate: null,
      status: "ASSIGNED"
    });
    const notificationsService = { createNotification: jest.fn() };
    const service = new WorkOrdersService(prisma as any, notificationsService as any, createWorkOrderPartsServiceMock() as any, createWorkOrderTaxonomyServiceMock() as any);

    await requestContext.run(
      {
        actorId: actor.sub,
        actorEmail: actor.email,
        actorRole: actor.role,
        tenantId: "tenant-a",
        module: "work-orders",
        ipAddress: null,
        userAgent: null,
        requestPath: "/work-orders/wo-1/assign"
      },
      () => service.assign("wo-1", "tech-1", actor)
    );

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "tech-1", tenantId: "tenant-a" })
      })
    );
  });
});
