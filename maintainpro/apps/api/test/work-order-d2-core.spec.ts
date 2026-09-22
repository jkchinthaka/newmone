import { ForbiddenException } from "@nestjs/common";
import {
  EvidenceType,
  EvidenceVerificationStatus,
  QrVerificationStatus,
  RoleName,
  WorkOrderApprovalStatus,
  WorkOrderStatus,
  WorkOrderType,
  WorkOrderVerificationStatus
} from "@prisma/client";

import { deriveActualCost } from "../src/common/utils/work-order-cost.util";
import { assertEvidenceForTechnicianCompletion } from "../src/common/utils/work-order-evidence-governance";
import { assertAllowedStatusTransition } from "../src/common/utils/work-order-governance";
import { sumLabourHours } from "../src/common/utils/work-order-labour.util";
import { isAllowedKanbanDrop } from "../src/common/utils/work-order-actions";
import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";
import { createWorkOrderPartsServiceMock } from "./helpers/work-order-parts-service.mock";
import { createWorkOrderTaxonomyServiceMock } from "./helpers/work-order-taxonomy-service.mock";

describe("work order D2 core", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalStorageFlag = process.env.STORAGE_UPLOADS_ENABLED;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.STORAGE_UPLOADS_ENABLED = originalStorageFlag;
  });

  it("rejects OPEN to IN_PROGRESS in the transition matrix", () => {
    expect(() =>
      assertAllowedStatusTransition(WorkOrderStatus.OPEN, WorkOrderStatus.IN_PROGRESS)
    ).toThrow();
  });

  it("blocks Kanban drops for hold and complete actions", () => {
    expect(isAllowedKanbanDrop(WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ON_HOLD)).toBe(false);
    expect(
      isAllowedKanbanDrop(WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.TECHNICIAN_COMPLETED)
    ).toBe(false);
  });

  it("sums labour hours from server-authoritative durations", () => {
    expect(
      sumLabourHours([
        {
          id: "labour-1",
          startedAt: new Date("2026-09-22T10:00:00.000Z"),
          endedAt: new Date("2026-09-22T11:00:00.000Z"),
          durationMinutes: 60
        },
        {
          id: "labour-2",
          startedAt: new Date("2026-09-22T11:15:00.000Z"),
          endedAt: new Date("2026-09-22T12:45:00.000Z")
        }
      ])
    ).toBe(2.5);
  });

  it("derives zero actual cost without inventing values", () => {
    expect(deriveActualCost({ partsCost: 0, labourCost: 0, vendorCost: 0 })).toBe(0);
  });

  it("fails closed for evidence when production storage is disabled", () => {
    process.env.NODE_ENV = "production";
    process.env.STORAGE_UPLOADS_ENABLED = "false";

    expect(() =>
      assertEvidenceForTechnicianCompletion({
        workOrderType: WorkOrderType.CORRECTIVE,
        items: [],
        completionNote: "Completed safely",
        qrStatus: QrVerificationStatus.VERIFIED,
        assetId: "asset-1"
      })
    ).toThrow("Evidence storage is unavailable. Completion is blocked while required photo evidence cannot be stored (fail closed).");
  });

  it("blocks supervisor self-verification without SoD override", async () => {
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          tenantId: "tenant-a",
          woNumber: "WO-2026-0001",
          status: WorkOrderStatus.TECHNICIAN_COMPLETED,
          approvalStatus: WorkOrderApprovalStatus.APPROVED,
          verificationStatus: WorkOrderVerificationStatus.PENDING,
          actualCost: 0,
          actualHours: 0,
          type: WorkOrderType.CORRECTIVE,
          priority: "MEDIUM",
          technicianId: "admin-1"
        }),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      workOrderStatusHistory: {
        findFirst: jest.fn().mockResolvedValue({ actorId: "admin-1" }),
        create: jest.fn()
      },
      evidenceAttachment: {
        findMany: jest.fn().mockResolvedValue([
          {
            evidenceType: EvidenceType.BEFORE_PHOTO,
            status: "UPLOADED",
            verificationStatus: EvidenceVerificationStatus.PENDING
          },
          {
            evidenceType: EvidenceType.AFTER_PHOTO,
            status: "UPLOADED",
            verificationStatus: EvidenceVerificationStatus.PENDING
          }
        ])
      },
      auditLog: { create: jest.fn() }
    };

    const service = new WorkOrdersService(
      prisma as any,
      { createNotification: jest.fn() } as any,
      createWorkOrderPartsServiceMock() as any,
      createWorkOrderTaxonomyServiceMock() as any,
      { addAssignee: jest.fn() } as any
    );

    await expect(
      service.verifySupervisor(
        "wo-1",
        { verificationNote: "Self-check" },
        {
          sub: "admin-1",
          email: "admin@maintainpro.local",
          role: RoleName.ADMIN,
          tenantId: "tenant-a"
        }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workOrder.update).not.toHaveBeenCalled();
    expect(prisma.workOrder.updateMany).not.toHaveBeenCalled();
  });

  it("ignores client actualHours/actualCost on technician completion", async () => {
    const prisma = {
      workOrder: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: "wo-1",
            tenantId: "tenant-a",
            woNumber: "WO-2026-0100",
            status: WorkOrderStatus.IN_PROGRESS,
            approvalStatus: WorkOrderApprovalStatus.APPROVED,
            type: WorkOrderType.CORRECTIVE,
            priority: "MEDIUM",
            technicianId: "tech-1",
            qrVerificationStatus: QrVerificationStatus.VERIFIED,
            assetId: "asset-1",
            vehicleId: null,
            actualCost: null,
            actualHours: null,
            startDate: new Date(),
            slaDeadline: null,
            completedDate: null,
            repairStartedAt: new Date(),
            repairCompletedAt: null,
            heldAt: null,
            resumedAt: null,
            holdNotes: null,
            holdReasonCode: null,
            acknowledgedAt: null,
            verificationStatus: WorkOrderVerificationStatus.PENDING,
            completionCondition: null,
            followUpRequired: false,
            followUpNote: null,
            delayReason: null,
            cancelledReason: null,
            technicianCompletionNote: null,
            dueDate: null,
            expectedCompletionDate: null,
            plannedEndAt: null,
            version: 1,
            lastIdempotencyKey: null
          })
          .mockResolvedValue({
            id: "wo-1",
            status: WorkOrderStatus.TECHNICIAN_COMPLETED,
            actualCost: 0,
            actualHours: 1,
            asset: null,
            vehicle: null,
            technician: null,
            createdBy: null,
            parts: []
          }),
        update: jest.fn().mockResolvedValue({
          id: "wo-1",
          status: WorkOrderStatus.TECHNICIAN_COMPLETED,
          actualCost: 0,
          actualHours: 1,
          woNumber: "WO-2026-0100"
        }),
        updateMany: jest.fn()
      },
      workOrderLabourEntry: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: "labour-1",
              technicianUserId: "tech-1",
              startedAt: new Date("2026-09-22T10:00:00.000Z"),
              endedAt: new Date("2026-09-22T11:00:00.000Z"),
              durationMinutes: 60,
              correctedDurationMinutes: null,
              labourRateSnapshot: 0
            }
          ]),
        update: jest.fn()
      },
      workOrderAssignee: { count: jest.fn().mockResolvedValue(1) },
      workOrderStatusHistory: { create: jest.fn() },
      workOrderCostSnapshot: { upsert: jest.fn() },
      evidenceAttachment: {
        findMany: jest.fn().mockResolvedValue([
          {
            evidenceType: EvidenceType.BEFORE_PHOTO,
            status: "UPLOADED",
            verificationStatus: EvidenceVerificationStatus.PENDING
          },
          {
            evidenceType: EvidenceType.AFTER_PHOTO,
            status: "UPLOADED",
            verificationStatus: EvidenceVerificationStatus.PENDING
          }
        ])
      },
      auditLog: { create: jest.fn() }
    };

    const parts = createWorkOrderPartsServiceMock();
    (parts as any).getCostSummary = jest.fn().mockResolvedValue({
      netPartCost: 0,
      unaccountedLines: 0
    });

    const service = new WorkOrdersService(
      prisma as any,
      { createNotification: jest.fn() } as any,
      parts as any,
      createWorkOrderTaxonomyServiceMock() as any,
      { addAssignee: jest.fn() } as any
    );

    process.env.STORAGE_UPLOADS_ENABLED = "true";

    await service.updateStatus(
      "wo-1",
      {
        status: WorkOrderStatus.TECHNICIAN_COMPLETED,
        completionNote: "Belt replaced and tested",
        actualCost: 9999,
        actualHours: 99
      },
      {
        sub: "tech-1",
        email: "tech@maintainpro.local",
        role: RoleName.TECHNICIAN,
        tenantId: "tenant-a"
      }
    );

    expect(prisma.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WorkOrderStatus.TECHNICIAN_COMPLETED,
          actualCost: 0,
          actualHours: 1
        })
      })
    );
  });
});
