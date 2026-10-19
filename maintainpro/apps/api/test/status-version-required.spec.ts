import { BadRequestException, ConflictException } from "@nestjs/common";
import { RoleName, WorkOrderApprovalStatus, WorkOrderStatus } from "@prisma/client";

import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";
import { createWorkOrderPartsServiceMock } from "./helpers/work-order-parts-service.mock";
import { createWorkOrderTaxonomyServiceMock } from "./helpers/work-order-taxonomy-service.mock";

/**
 * Optimistic concurrency stays mandatory: a missing version is bad input (400),
 * a stale version is a real conflict (409).
 */
describe("updateStatus expectedVersion contract", () => {
  const technician = { sub: "tech-1", email: "tech@maintainpro.local", role: RoleName.TECHNICIAN, tenantId: "tenant-a" };
  const assigned = {
    id: "wo-1",
    woNumber: "WO-2026-0100",
    approvalStatus: WorkOrderApprovalStatus.APPROVED,
    status: WorkOrderStatus.ASSIGNED,
    priority: "MEDIUM",
    technicianId: "tech-1",
    startDate: null,
    slaDeadline: null,
    completedDate: null,
    delayReason: null,
    dueDate: new Date("2026-06-20T00:00:00.000Z"),
    expectedCompletionDate: null,
    plannedEndAt: null,
    version: 4
  };

  function build(updateCount: number) {
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          ...assigned,
          asset: null,
          vehicle: null,
          technician: null,
          createdBy: null,
          parts: []
        }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: updateCount }),
        count: jest.fn().mockResolvedValue(1)
      },
      workOrderLabourEntry: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn() },
      workOrderHoldHistory: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      workOrderStatusHistory: { create: jest.fn(), findFirst: jest.fn() },
      workOrderCostSnapshot: { upsert: jest.fn() },
      workOrderAssignee: { count: jest.fn().mockResolvedValue(1) },
      auditLog: { create: jest.fn() }
    };
    const service = new WorkOrdersService(
      prisma as any,
      { createNotification: jest.fn() } as any,
      createWorkOrderPartsServiceMock() as any,
      createWorkOrderTaxonomyServiceMock() as any,
      { addAssignee: jest.fn() } as any
    );
    return { service, prisma };
  }

  it("returns 400 'expectedVersion is required' when the client sends no version", async () => {
    const { service, prisma } = build(1);
    const attempt = service.updateStatus("wo-1", { status: WorkOrderStatus.IN_PROGRESS }, technician);
    await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateStatus("wo-1", { status: WorkOrderStatus.IN_PROGRESS }, technician)
    ).rejects.toThrow("expectedVersion is required");
    expect(prisma.workOrder.updateMany).not.toHaveBeenCalled();
  });

  it("returns 409 when the version is stale", async () => {
    const { service } = build(0);
    await expect(
      service.updateStatus("wo-1", { status: WorkOrderStatus.IN_PROGRESS, expectedVersion: 3 }, technician)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("writes with compare-and-set on id and version", async () => {
    const { service, prisma } = build(1);
    await service.updateStatus("wo-1", { status: WorkOrderStatus.IN_PROGRESS, expectedVersion: 4 }, technician);
    expect(prisma.workOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "wo-1", version: 4 } })
    );
  });
});
