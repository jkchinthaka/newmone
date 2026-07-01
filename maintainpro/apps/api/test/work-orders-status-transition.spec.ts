import { BadRequestException } from "@nestjs/common";
import {
  RoleName,
  WorkOrderApprovalStatus,
  WorkOrderStatus
} from "@prisma/client";

import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";
import { createWorkOrderPartsServiceMock } from "./helpers/work-order-parts-service.mock";
import { createWorkOrderTaxonomyServiceMock } from "./helpers/work-order-taxonomy-service.mock";

const createPrismaMock = () => ({
  workOrder: {
    findFirst: jest.fn(),
    update: jest.fn()
  },
  auditLog: {
    create: jest.fn()
  }
});

describe("WorkOrdersService status transitions", () => {
  const technician = {
    sub: "tech-1",
    email: "tech@maintainpro.local",
    role: RoleName.TECHNICIAN,
    tenantId: "tenant-a"
  };

  const approvedOpenWorkOrder = {
    id: "wo-1",
    woNumber: "WO-2026-0100",
    approvalStatus: WorkOrderApprovalStatus.APPROVED,
    status: WorkOrderStatus.OPEN,
    priority: "MEDIUM",
    startDate: null,
    slaDeadline: null,
    completedDate: null,
    delayReason: null,
    dueDate: new Date("2026-06-20T00:00:00.000Z"),
    expectedCompletionDate: null,
    plannedEndAt: null
  };

  const inProgressWorkOrder = {
    ...approvedOpenWorkOrder,
    status: WorkOrderStatus.IN_PROGRESS,
    startDate: new Date("2026-06-12T08:00:00.000Z"),
    slaDeadline: new Date("2026-06-15T08:00:00.000Z")
  };

  it("starts an approved open work order and persists IN_PROGRESS", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst
      .mockResolvedValueOnce(approvedOpenWorkOrder)
      .mockResolvedValueOnce({
        ...inProgressWorkOrder,
        asset: null,
        vehicle: null,
        technician: null,
        createdBy: null,
        parts: []
      });
    prisma.workOrder.update.mockResolvedValue(inProgressWorkOrder);
    prisma.auditLog.create.mockResolvedValue({ id: "audit-start" });

    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any, createWorkOrderPartsServiceMock() as any, createWorkOrderTaxonomyServiceMock() as any);

    const updated = await service.updateStatus(
      "wo-1",
      { status: WorkOrderStatus.IN_PROGRESS },
      technician
    );

    expect(prisma.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wo-1" },
        data: expect.objectContaining({
          status: WorkOrderStatus.IN_PROGRESS,
          startDate: expect.any(Date),
          slaDeadline: expect.any(Date)
        })
      })
    );
    expect(updated.status).toBe(WorkOrderStatus.IN_PROGRESS);
  });

  it("blocks start when work order approval is still pending", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst.mockResolvedValue({
      ...approvedOpenWorkOrder,
      approvalStatus: WorkOrderApprovalStatus.PENDING
    });

    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any, createWorkOrderPartsServiceMock() as any, createWorkOrderTaxonomyServiceMock() as any);

    await expect(
      service.updateStatus("wo-1", { status: WorkOrderStatus.IN_PROGRESS }, technician)
    ).rejects.toThrow(BadRequestException);
    expect(prisma.workOrder.update).not.toHaveBeenCalled();
  });
});
