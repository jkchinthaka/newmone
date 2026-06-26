import { BadRequestException } from "@nestjs/common";
import {
  AuditAction,
  RoleName,
  WorkOrderApprovalStatus,
  WorkOrderStatus
} from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";

const createPrismaMock = () => ({
  workOrder: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  user: {
    findFirst: jest.fn()
  },
  auditLog: {
    create: jest.fn()
  },
  sparePart: {
    findFirst: jest.fn(),
    update: jest.fn()
  },
  workOrderPart: {
    create: jest.fn()
  },
  stockMovement: {
    create: jest.fn()
  },
  partRequest: {
    findMany: jest.fn(),
    create: jest.fn()
  },
  $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback({}))
});

describe("WorkOrdersService approval and audit", () => {
  const manager = {
    sub: "manager-1",
    email: "manager@maintainpro.local",
    role: RoleName.MANAGER,
    tenantId: "tenant-a"
  };

  const technician = {
    sub: "tech-1",
    email: "tech@maintainpro.local",
    role: RoleName.TECHNICIAN,
    tenantId: "tenant-a"
  };

  it("auto-approves work orders created by managers", async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue({ id: "507f1f77bcf86cd799439011", tenantId: "tenant-a" });
    prisma.workOrder.count.mockResolvedValue(0);
    prisma.workOrder.create.mockResolvedValue({
      id: "wo-1",
      woNumber: "WO-2026-0001",
      status: WorkOrderStatus.OPEN,
      approvalStatus: WorkOrderApprovalStatus.APPROVED,
      priority: "MEDIUM",
      type: "CORRECTIVE",
      title: "Pump repair"
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any);

    const created = await requestContext.run(
      {
        actorId: manager.sub,
        actorEmail: manager.email,
        actorRole: manager.role,
        tenantId: manager.tenantId,
        module: "work-orders",
        ipAddress: null,
        userAgent: null,
        requestPath: "/work-orders"
      },
      () =>
        service.create(
          {
            title: "Pump repair",
            description: "Replace seal",
            priority: "MEDIUM",
            type: "CORRECTIVE",
            createdById: "507f1f77bcf86cd799439011"
          },
          manager
        )
    );

    expect(created.approvalStatus).toBe(WorkOrderApprovalStatus.APPROVED);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entity: "WorkOrder",
          action: AuditAction.CREATE,
          metadata: expect.objectContaining({ event: "work_order_created" })
        })
      })
    );
  });

  it("requires approval before assignment when pending", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst.mockResolvedValue({
      id: "wo-1",
      woNumber: "WO-2026-0002",
      approvalStatus: WorkOrderApprovalStatus.PENDING,
      status: WorkOrderStatus.OPEN,
      technicianId: null
    });

    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any);

    await expect(service.assign("wo-1", "tech-1", manager)).rejects.toThrow(BadRequestException);
    expect(prisma.workOrder.update).not.toHaveBeenCalled();
  });

  it("approves pending work orders and writes audit metadata", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst.mockResolvedValue({
      id: "wo-1",
      woNumber: "WO-2026-0003",
      approvalStatus: WorkOrderApprovalStatus.PENDING,
      status: WorkOrderStatus.OPEN
    });
    prisma.workOrder.update.mockResolvedValue({
      id: "wo-1",
      woNumber: "WO-2026-0003",
      approvalStatus: WorkOrderApprovalStatus.APPROVED,
      approvedById: manager.sub
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-2" });

    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any);

    const updated = await service.approveWorkOrder("wo-1", "Approved for execution", manager);

    expect(updated.approvalStatus).toBe(WorkOrderApprovalStatus.APPROVED);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ event: "work_order_approved" })
        })
      })
    );
  });

  it("rejects pending work orders with reason and cancels status", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst.mockResolvedValue({
      id: "wo-1",
      woNumber: "WO-2026-0004",
      approvalStatus: WorkOrderApprovalStatus.PENDING,
      status: WorkOrderStatus.OPEN
    });
    prisma.workOrder.update.mockResolvedValue({
      id: "wo-1",
      approvalStatus: WorkOrderApprovalStatus.REJECTED,
      status: WorkOrderStatus.CANCELLED,
      rejectionReason: "Insufficient detail"
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-3" });

    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any);

    const updated = await service.rejectWorkOrder("wo-1", "Insufficient detail", manager);

    expect(updated.approvalStatus).toBe(WorkOrderApprovalStatus.REJECTED);
    expect(updated.status).toBe(WorkOrderStatus.CANCELLED);
  });

  it("audits status completion updates", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst.mockResolvedValue({
      id: "wo-1",
      woNumber: "WO-2026-0005",
      approvalStatus: WorkOrderApprovalStatus.APPROVED,
      status: WorkOrderStatus.IN_PROGRESS,
      priority: "MEDIUM",
      startDate: new Date(),
      slaDeadline: null,
      completedDate: null,
      actualCost: null,
      actualHours: null
    });
    prisma.workOrder.update.mockResolvedValue({
      id: "wo-1",
      woNumber: "WO-2026-0005",
      status: WorkOrderStatus.COMPLETED,
      actualCost: 100,
      actualHours: 2,
      completedDate: new Date()
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-4" });

    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any);

    await service.updateStatus(
      "wo-1",
      { status: WorkOrderStatus.COMPLETED, actualCost: 100, actualHours: 2 },
      technician
    );

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ event: "work_order_completed" })
        })
      })
    );
  });
});
