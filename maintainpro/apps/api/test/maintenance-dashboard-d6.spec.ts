import { Priority, WorkOrderStatus } from "@prisma/client";

import {
  buildAttentionQueues,
  isCriticalOpen,
  isDashboardOverdue,
  toneForCount
} from "../src/common/utils/maintenance-dashboard.util";
import { MaintenanceConfigService } from "../src/modules/maintenance-config/maintenance-config.service";

describe("D6 maintenance dashboard util", () => {
  const now = new Date("2026-09-23T12:00:00.000Z");

  it("detects overdue by status and dueDate", () => {
    expect(isDashboardOverdue(WorkOrderStatus.OVERDUE, null, now)).toBe(true);
    expect(isDashboardOverdue(WorkOrderStatus.IN_PROGRESS, "2026-09-22T00:00:00.000Z", now)).toBe(
      true
    );
    expect(isDashboardOverdue(WorkOrderStatus.IN_PROGRESS, "2026-09-24T00:00:00.000Z", now)).toBe(
      false
    );
    expect(isDashboardOverdue(WorkOrderStatus.CLOSED, "2026-09-01T00:00:00.000Z", now)).toBe(false);
  });

  it("detects critical open only for open statuses", () => {
    expect(isCriticalOpen(Priority.CRITICAL, WorkOrderStatus.OPEN)).toBe(true);
    expect(isCriticalOpen(Priority.CRITICAL, WorkOrderStatus.CLOSED)).toBe(false);
    expect(isCriticalOpen(Priority.MEDIUM, WorkOrderStatus.OPEN)).toBe(false);
  });

  it("builds attention queue links with tones and hrefs", () => {
    const queues = buildAttentionQueues({
      overdue: 2,
      unplanned: 0,
      unassigned: 1,
      inProgress: 3,
      onHold: 0,
      verificationRequired: 4,
      reworkRequired: 1,
      critical: 1,
      requestsOpen: 5
    });
    expect(queues.find((q) => q.key === "overdue")?.href).toContain("smartView=overdue");
    expect(queues.find((q) => q.key === "verification")?.count).toBe(4);
    expect(toneForCount(0)).toBe("default");
    expect(toneForCount(2, 1)).toBe("critical");
  });
});

describe("D6 maintenance dashboard opsOverview", () => {
  function mockPrisma(overrides: Record<string, unknown> = {}) {
    const count = jest.fn().mockResolvedValue(0);
    return {
      workOrder: { count, findMany: jest.fn().mockResolvedValue([]) },
      approvalRequest: { count: jest.fn().mockResolvedValue(0) },
      pmPlan: { count: jest.fn().mockResolvedValue(0) },
      maintenanceRequest: { count: jest.fn().mockResolvedValue(0) },
      sparePart: {
        findMany: jest.fn().mockResolvedValue([
          { id: "p1", quantityInStock: 1, minimumStock: 5, reorderPoint: null },
          { id: "p2", quantityInStock: 10, minimumStock: 2, reorderPoint: null }
        ])
      },
      ...overrides
    };
  }

  it("returns status buckets and hides inventory for technicians", async () => {
    const prisma = mockPrisma();
    (prisma.workOrder.count as jest.Mock).mockResolvedValue(3);
    const service = new MaintenanceConfigService(prisma as never);
    const data = await service.opsOverview({
      sub: "tech-1",
      tenantId: "tenant-a",
      role: "TECHNICIAN"
    });

    expect(data.openJobs).toBe(3);
    expect(data.attentionQueues.length).toBeGreaterThan(0);
    expect(data.lowStock).toBeNull();
    expect(data.availability.inventory).toBe(false);
    expect(data.pendingApprovals).toBeNull();
    expect(data.availability.approvals).toBe(false);
    expect(data.notAvailable.mttr).toBe("Not Configured");
    expect(prisma.sparePart.findMany).not.toHaveBeenCalled();
  });

  it("returns low stock for inventory-capable roles", async () => {
    const prisma = mockPrisma();
    const service = new MaintenanceConfigService(prisma as never);
    const data = await service.opsOverview({
      sub: "admin-1",
      tenantId: "tenant-a",
      role: "ADMIN"
    });
    expect(data.availability.inventory).toBe(true);
    expect(data.lowStock).toBe(1);
    expect(data.availability.approvals).toBe(true);
    expect(typeof data.pendingApprovals).toBe("number");
  });

  it("returns the priority work list scoped to the current tenant, mapped for the UI", async () => {
    const dueDate = new Date("2026-09-20T00:00:00.000Z");
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "wo-1",
        woNumber: "WO-2026-0001",
        title: "Replace conveyor belt",
        jobDomain: "MACHINERY",
        status: "OVERDUE",
        priority: "CRITICAL",
        dueDate
      }
    ]);
    const prisma = mockPrisma({ workOrder: { count: jest.fn().mockResolvedValue(0), findMany } });
    const service = new MaintenanceConfigService(prisma as never);
    const data = await service.opsOverview({
      sub: "admin-1",
      tenantId: "tenant-a",
      role: "ADMIN"
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-a" }),
        take: 8
      })
    );
    expect(data.priorityWorkList).toEqual([
      {
        id: "wo-1",
        woNumber: "WO-2026-0001",
        title: "Replace conveyor belt",
        jobDomain: "MACHINERY",
        status: "OVERDUE",
        priority: "CRITICAL",
        dueDate: dueDate.toISOString()
      }
    ]);
  });

  it("fails closed without tenant", async () => {
    const service = new MaintenanceConfigService(mockPrisma() as never);
    await expect(
      service.opsOverview({ sub: "x", tenantId: null as never, role: "ADMIN" })
    ).rejects.toThrow();
  });
});
