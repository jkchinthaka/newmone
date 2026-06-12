import { NotFoundException } from "@nestjs/common";
import { NotificationPriority } from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import { NotificationsService } from "../src/modules/notifications/notifications.service";

const buildContext = (tenantId: string | null) => ({
  actorId: "actor-1",
  actorEmail: "actor@example.com",
  actorRole: "ADMIN",
  tenantId,
  module: "notifications",
  ipAddress: null,
  userAgent: null,
  requestPath: "/notifications"
});

const createService = () => {
  const prisma = {
    workOrder: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: "wo-1", woNumber: "WO-2026-0001", dueDate: null }),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    facilityIssue: {
      findFirst: jest.fn()
    }
  };

  const service = new NotificationsService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );

  return { service, prisma };
};

describe("NotificationsService tenant isolation", () => {
  it("createWorkOrderFromNotification stamps tenantId from request context", async () => {
    const { service, prisma } = createService();

    await requestContext.run(buildContext("tenant-a"), () =>
      (service as any).createWorkOrderFromNotification(
        {
          title: "Follow-up",
          message: "Inspect pump",
          priority: NotificationPriority.INFO
        },
        "actor-1",
        {}
      )
    );

    expect(prisma.workOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "tenant-a" })
      })
    );
  });

  it("assertReferenceTenantAccess blocks cross-tenant work order references", async () => {
    const { service, prisma } = createService();
    prisma.workOrder.findFirst.mockResolvedValue(null);

    await expect(
      requestContext.run(buildContext("tenant-a"), () =>
        (service as any).assertReferenceTenantAccess("WorkOrder", "wo-other-tenant")
      )
    ).rejects.toThrow(NotFoundException);

    expect(prisma.workOrder.findFirst).toHaveBeenCalledWith({
      where: { id: "wo-other-tenant", tenantId: "tenant-a" },
      select: { id: true }
    });
  });
});
