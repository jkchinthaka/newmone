import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  AuditAction,
  RoleName,
  WorkOrderApprovalStatus,
  WorkOrderStatus,
  WorkOrderVerificationStatus
} from "@prisma/client";

import { createWorkOrderPartsServiceMock } from "./helpers/work-order-parts-service.mock";
import { createWorkOrderTaxonomyServiceMock } from "./helpers/work-order-taxonomy-service.mock";

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
  user: { findFirst: jest.fn() },
  auditLog: { create: jest.fn() },
  sparePart: { findFirst: jest.fn(), update: jest.fn() },
  workOrderPart: { findFirst: jest.fn(), create: jest.fn() },
  stockMovement: { create: jest.fn() },
  partRequest: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  workOrderAssignee: { count: jest.fn().mockResolvedValue(1) },
  evidenceAttachment: {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([
      { evidenceType: "BEFORE_PHOTO", status: "UPLOADED", verificationStatus: "PENDING" },
      { evidenceType: "AFTER_PHOTO", status: "UPLOADED", verificationStatus: "PENDING" }
    ])
  },
  $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback({}))
});

describe("WorkOrdersService governance (UAT-009)", () => {
  const originalStorageFlag = process.env.STORAGE_UPLOADS_ENABLED;

  beforeAll(() => {
    process.env.STORAGE_UPLOADS_ENABLED = "true";
  });

  afterAll(() => {
    process.env.STORAGE_UPLOADS_ENABLED = originalStorageFlag;
  });

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

  const admin = {
    sub: "admin-1",
    email: "admin@maintainpro.local",
    role: RoleName.ADMIN,
    tenantId: "tenant-a"
  };

  const baseWorkOrder = {
    id: "wo-1",
    woNumber: "WO-2026-0001",
    approvalStatus: WorkOrderApprovalStatus.APPROVED,
    priority: "MEDIUM",
    type: "CORRECTIVE",
    startDate: new Date(),
    slaDeadline: null,
    completedDate: null,
    actualCost: null,
    actualHours: null,
    verificationStatus: WorkOrderVerificationStatus.NOT_REQUIRED,
    delayReason: null,
    cancelledReason: null,
    technicianCompletionNote: null,
    dueDate: null,
    expectedCompletionDate: null,
    plannedStartAt: null,
    plannedEndAt: null,
    qrVerificationStatus: null,
    assetId: null,
    vehicleId: null,
    completionCondition: null,
    followUpRequired: false,
    followUpNote: null
  };

  it("blocks IN_PROGRESS from moving back to OPEN", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst.mockResolvedValue({
      ...baseWorkOrder,
      status: WorkOrderStatus.IN_PROGRESS
    });
    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any, createWorkOrderPartsServiceMock() as any, createWorkOrderTaxonomyServiceMock() as any, { addAssignee: jest.fn() } as any);

    await expect(
      service.updateStatus("wo-1", { status: WorkOrderStatus.OPEN }, manager)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks COMPLETED from moving back to OPEN via status update", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst.mockResolvedValue({
      ...baseWorkOrder,
      status: WorkOrderStatus.COMPLETED
    });
    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any, createWorkOrderPartsServiceMock() as any, createWorkOrderTaxonomyServiceMock() as any, { addAssignee: jest.fn() } as any);

    await expect(
      service.updateStatus("wo-1", { status: WorkOrderStatus.OPEN }, admin)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("requires cancel reason", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst.mockResolvedValue({
      ...baseWorkOrder,
      status: WorkOrderStatus.IN_PROGRESS
    });
    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any, createWorkOrderPartsServiceMock() as any, createWorkOrderTaxonomyServiceMock() as any, { addAssignee: jest.fn() } as any);

    await expect(
      service.updateStatus("wo-1", { status: WorkOrderStatus.CANCELLED }, manager)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("routes technician completion to TECHNICIAN_COMPLETED with note", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst
      .mockResolvedValueOnce({
        ...baseWorkOrder,
        status: WorkOrderStatus.IN_PROGRESS
      })
      .mockResolvedValueOnce({
        ...baseWorkOrder,
        status: WorkOrderStatus.TECHNICIAN_COMPLETED,
        actualCost: 100,
        actualHours: 2
      });
    prisma.workOrder.update.mockResolvedValue({
      ...baseWorkOrder,
      status: WorkOrderStatus.TECHNICIAN_COMPLETED,
      actualCost: 100,
      actualHours: 2
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any, createWorkOrderPartsServiceMock() as any, createWorkOrderTaxonomyServiceMock() as any, { addAssignee: jest.fn() } as any);
    await service.updateStatus(
      "wo-1",
      {
        status: WorkOrderStatus.COMPLETED,
        actualCost: 100,
        actualHours: 2,
        completionNote: "Replaced belt and tested operation"
      },
      technician
    );

    expect(prisma.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: WorkOrderStatus.TECHNICIAN_COMPLETED })
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ event: "technician_completion_submitted" })
        })
      })
    );
  });

  it("requires supervisor verification before manager can close from IN_PROGRESS", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst.mockResolvedValue({
      ...baseWorkOrder,
      status: WorkOrderStatus.IN_PROGRESS
    });
    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any, createWorkOrderPartsServiceMock() as any, createWorkOrderTaxonomyServiceMock() as any, { addAssignee: jest.fn() } as any);

    await expect(
      service.updateStatus(
        "wo-1",
        { status: WorkOrderStatus.COMPLETED, actualCost: 100, actualHours: 2 },
        manager
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("supervisor verification closes technician-completed jobs", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst
      .mockResolvedValueOnce({
        ...baseWorkOrder,
        status: WorkOrderStatus.TECHNICIAN_COMPLETED,
        actualCost: 100,
        actualHours: 2
      })
      .mockResolvedValueOnce({
        ...baseWorkOrder,
        status: WorkOrderStatus.COMPLETED,
        verificationStatus: WorkOrderVerificationStatus.VERIFIED
      });
    prisma.workOrder.update.mockResolvedValue({
      ...baseWorkOrder,
      status: WorkOrderStatus.COMPLETED,
      verificationStatus: WorkOrderVerificationStatus.VERIFIED
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-2" });

    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any, createWorkOrderPartsServiceMock() as any, createWorkOrderTaxonomyServiceMock() as any, { addAssignee: jest.fn() } as any);
    await service.verifySupervisor("wo-1", { verificationNote: "Work verified on site" }, manager);

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ event: "work_order_supervisor_verified" })
        })
      })
    );
  });

  it("supervisor rejection moves job to REWORK_REQUIRED", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst
      .mockResolvedValueOnce({
        ...baseWorkOrder,
        status: WorkOrderStatus.TECHNICIAN_COMPLETED
      })
      .mockResolvedValueOnce({
        ...baseWorkOrder,
        status: WorkOrderStatus.REWORK_REQUIRED
      });
    prisma.workOrder.update.mockResolvedValue({
      ...baseWorkOrder,
      status: WorkOrderStatus.REWORK_REQUIRED,
      verificationRejectionReason: "Quality check failed"
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-3" });

    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any, createWorkOrderPartsServiceMock() as any, createWorkOrderTaxonomyServiceMock() as any, { addAssignee: jest.fn() } as any);
    await service.rejectSupervisor("wo-1", "Quality check failed", manager);

    expect(prisma.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: WorkOrderStatus.REWORK_REQUIRED })
      })
    );
  });

  it("reopen requires admin role and reason", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst
      .mockResolvedValueOnce({
        ...baseWorkOrder,
        status: WorkOrderStatus.COMPLETED
      })
      .mockResolvedValueOnce({
        ...baseWorkOrder,
        status: WorkOrderStatus.OPEN
      });
    prisma.workOrder.update.mockResolvedValue({
      ...baseWorkOrder,
      status: WorkOrderStatus.OPEN
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-reopen" });
    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any, createWorkOrderPartsServiceMock() as any, createWorkOrderTaxonomyServiceMock() as any, { addAssignee: jest.fn() } as any);

    await expect(service.reopenWorkOrder("wo-1", "bad", technician)).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(
      service.reopenWorkOrder("wo-1", "Reopen for correction after audit finding", admin)
    ).resolves.toBeDefined();
  });

  it("locks sensitive schedule fields after work starts", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst.mockResolvedValue({
      ...baseWorkOrder,
      status: WorkOrderStatus.IN_PROGRESS
    });
    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any, createWorkOrderPartsServiceMock() as any, createWorkOrderTaxonomyServiceMock() as any, { addAssignee: jest.fn() } as any);

    await expect(
      service.update("wo-1", { expectedCompletionDate: "2026-08-01" }, manager)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks duplicate direct part issue on same work order", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst.mockResolvedValue({
      ...baseWorkOrder,
      status: WorkOrderStatus.IN_PROGRESS
    });
    prisma.workOrderPart.findFirst.mockResolvedValue({ id: "line-1" });
    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any, createWorkOrderPartsServiceMock() as any, createWorkOrderTaxonomyServiceMock() as any, { addAssignee: jest.fn() } as any);

    await expect(
      service.addPart("wo-1", { partId: "part-1", quantity: 2, unitCost: 10 }, manager)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks negative part quantity", async () => {
    const prisma = createPrismaMock();
    prisma.workOrder.findFirst.mockResolvedValue({
      ...baseWorkOrder,
      status: WorkOrderStatus.IN_PROGRESS
    });
    prisma.workOrderPart.findFirst.mockResolvedValue(null);
    const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any, createWorkOrderPartsServiceMock() as any, createWorkOrderTaxonomyServiceMock() as any, { addAssignee: jest.fn() } as any);

    await expect(
      service.addPart("wo-1", { partId: "part-1", quantity: 0, unitCost: 10 }, manager)
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
