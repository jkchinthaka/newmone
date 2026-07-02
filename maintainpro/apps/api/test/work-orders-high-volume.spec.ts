import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { RoleName, WorkOrderStatus } from "@prisma/client";

import { parseWorkOrderListQuery } from "../src/modules/work-orders/work-order-list-query.util";
import { WorkOrderQueuesService } from "../src/modules/work-orders/work-order-queues.service";
import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";

describe("UAT-019 high-volume work orders", () => {
  const actor = {
    sub: "user-1",
    email: "admin@maintainpro.local",
    role: RoleName.ADMIN,
    tenantId: "tenant-1"
  };

  function buildQueueService(
    overrides?: Partial<{
      count: (args: { where: unknown }) => number | Promise<number>;
      findMany: (args: { where: unknown; skip?: number; take?: number }) => unknown[] | Promise<unknown[]>;
    }>
  ) {
    const prisma = {
      workOrder: {
        count: jest.fn(async (args: { where: unknown }) => (overrides?.count ? overrides.count(args) : 0)),
        findMany: jest.fn(async (args: { where: unknown; skip?: number; take?: number }) =>
          overrides?.findMany ? overrides.findMany(args) : []
        )
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
    return { service, prisma };
  }

  it("parses paginated list query params", () => {
    const parsed = parseWorkOrderListQuery({
      page: "2",
      pageSize: "50",
      search: "brake",
      queue: "overdue",
      taxonomyCategoryId: "cat-1",
      sortBy: "dueDate",
      sortDirection: "asc"
    });

    expect(parsed.page).toBe("2");
    expect(parsed.pageSize).toBe("50");
    expect(parsed.search).toBe("brake");
    expect(parsed.queue).toBe("overdue");
    expect(parsed.taxonomyCategoryId).toBe("cat-1");
    expect(parsed.sortBy).toBe("dueDate");
    expect(parsed.sortDirection).toBe("asc");
  });

  it("maps open queue alias to open-requests", () => {
    const parsed = parseWorkOrderListQuery({ queue: "open", page: "1", pageSize: "25" });
    expect(parsed.queue).toBe("open-requests");
  });

  it("maps smart view to queue and date filters", () => {
    const parsed = parseWorkOrderListQuery({ smartView: "triage", page: "1", pageSize: "25" });
    expect(parsed.queue).toBe("triage");
    expect(parsed.triageOnly).toBe(true);
  });

  it("returns paginated empty list for empty DB", async () => {
    const { service } = buildQueueService();
    const result = await service.listWorkOrders(actor, { queue: "open-requests", page: 1, pageSize: 25 });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
    expect(result.summary?.total).toBe(0);
  });

  it("enforces max pageSize of 100", async () => {
    const { service, prisma } = buildQueueService({
      findMany: async ({ take }) => [{ id: "wo-1", status: WorkOrderStatus.OPEN, parts: [], assignees: [], evidenceAttachments: [], partIssues: [], priority: "MEDIUM", dueDate: null, updatedAt: new Date(), createdAt: new Date(), isTriage: false, type: "CORRECTIVE", approvalStatus: "APPROVED", verificationStatus: "NOT_REQUIRED", slaBreached: false }]
    });

    await service.listWorkOrders(actor, { queue: "open-requests", page: 1, pageSize: 500 });
    expect(prisma.workOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  it("applies server-side search in prisma where", async () => {
    const { service, prisma } = buildQueueService();
    await service.listWorkOrders(actor, { queue: "all", page: 1, pageSize: 25, search: "brake" });

    const serialized = JSON.stringify(prisma.workOrder.findMany.mock.calls[0][0].where);
    expect(serialized).toContain("brake");
  });

  it("scopes technician my-tasks to assigned jobs", async () => {
    const technician = { ...actor, sub: "tech-1", role: RoleName.TECHNICIAN };
    const { service, prisma } = buildQueueService();
    await service.listWorkOrders(technician, { queue: "my-tasks", page: 1, pageSize: 25 });

    const serialized = JSON.stringify(prisma.workOrder.findMany.mock.calls[0][0].where);
    expect(serialized).toContain("tech-1");
  });

  it("blocks technician from all-company queue", async () => {
    const technician = { ...actor, sub: "tech-1", role: RoleName.TECHNICIAN };
    const { service } = buildQueueService();
    await expect(service.listWorkOrders(technician, { queue: "all", page: 1, pageSize: 25 })).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("bulk assign blocks technician permission", async () => {
    const prisma = {
      workOrder: { findFirst: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() }
    };
    const service = new WorkOrdersService(
      prisma as never,
      { createNotification: jest.fn() } as never,
      {} as never,
      {} as never,
      { addAssignee: jest.fn() } as never
    );

    await expect(
      service.bulkAssign(
        { workOrderIds: ["wo-1"], assigneeEmployeeIds: ["emp-1"] },
        { ...actor, role: RoleName.TECHNICIAN }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("bulk status blocks completion without governance", async () => {
    const service = new WorkOrdersService(
      { workOrder: { findFirst: jest.fn() } } as never,
      { createNotification: jest.fn() } as never,
      {} as never,
      {} as never,
      { addAssignee: jest.fn() } as never
    );

    await expect(
      service.bulkStatus(
        { workOrderIds: ["wo-1"], targetStatus: WorkOrderStatus.COMPLETED },
        actor
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("bulk status requires cancel reason", async () => {
    const service = new WorkOrdersService(
      { workOrder: { findFirst: jest.fn() } } as never,
      { createNotification: jest.fn() } as never,
      {} as never,
      {} as never,
      { addAssignee: jest.fn() } as never
    );

    await expect(
      service.bulkStatus({ workOrderIds: ["wo-1"], targetStatus: WorkOrderStatus.CANCELLED }, actor)
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
