import { RoleName, WorkOrderStatus } from "@prisma/client";

import { WorkOrderQueuesService } from "../src/modules/work-orders/work-order-queues.service";

describe("WorkOrderQueuesService summary", () => {
  const actor = {
    sub: "user-1",
    email: "admin@maintainpro.local",
    role: RoleName.ADMIN,
    tenantId: "tenant-1"
  };

  function buildService(rows: unknown[]) {
    const prisma = {
      workOrder: {
        findMany: jest.fn().mockResolvedValue(rows)
      }
    };
    const maintenanceReports = {
      computeWorkOrderRiskFactors: jest.fn().mockResolvedValue({})
    };
    const categoryReports = {
      getCategorySummary: jest.fn()
    };
    const service = new WorkOrderQueuesService(
      prisma as never,
      maintenanceReports as never,
      categoryReports as never
    );
    return { service, prisma, maintenanceReports };
  }

  it("returns 200-shaped summary with zero counts for empty data", async () => {
    const { service } = buildService([]);
    const summary = await service.getQueueSummary(actor);

    expect(summary.queues.length).toBeGreaterThan(0);
    expect(summary.queues.every((queue) => queue.count === 0)).toBe(true);
    expect(summary.defaultQueue).toBe("action-required");
    expect(summary.summary.actionRequired).toBe(0);
    expect(summary.lastUpdated).toBeTruthy();
  });

  it("handles old work orders without taxonomy fields", async () => {
    const { service } = buildService([
      {
        id: "wo-1",
        tenantId: "tenant-1",
        title: "Legacy WO",
        status: WorkOrderStatus.OPEN,
        priority: "MEDIUM",
        type: "CORRECTIVE",
        dueDate: null,
        taxonomyCategoryId: null,
        taxonomyTypeId: null,
        taxonomyIssueId: null,
        isTriage: false,
        categoryNameSnapshot: null,
        approvalStatus: "NOT_REQUIRED",
        verificationStatus: "NOT_REQUIRED",
        technicianId: null,
        assignees: [],
        parts: [],
        partIssues: [],
        evidenceAttachments: [],
        vendorRepairCase: null,
        asset: null,
        vehicle: null,
        technician: null,
        createdBy: null,
        updatedAt: new Date()
      }
    ]);

    const summary = await service.getQueueSummary(actor);
    expect(summary.queues.find((queue) => queue.key === "open-requests")?.count).toBe(1);
  });

  it("keeps summary usable when risk enrichment fails for a row", async () => {
    const { service, maintenanceReports } = buildService([
      {
        id: "wo-2",
        tenantId: "tenant-1",
        title: "Broken WO",
        status: WorkOrderStatus.IN_PROGRESS,
        priority: "HIGH",
        type: "CORRECTIVE",
        dueDate: null,
        taxonomyCategoryId: null,
        isTriage: false,
        approvalStatus: "NOT_REQUIRED",
        verificationStatus: "NOT_REQUIRED",
        technicianId: null,
        assignees: [],
        parts: [],
        partIssues: [],
        evidenceAttachments: [],
        vendorRepairCase: null,
        asset: null,
        vehicle: null,
        technician: null,
        createdBy: null,
        updatedAt: new Date()
      }
    ]);
    maintenanceReports.computeWorkOrderRiskFactors.mockRejectedValue(new Error("risk failed"));

    const summary = await service.getQueueSummary(actor);
    expect(summary.queues.find((queue) => queue.key === "in-progress")?.count).toBe(1);
    expect(summary.summary.actionRequired).toBeGreaterThanOrEqual(0);
  });
});
