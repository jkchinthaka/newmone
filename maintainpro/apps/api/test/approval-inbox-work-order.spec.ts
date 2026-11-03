import { BadRequestException } from "@nestjs/common";

import { ApprovalInboxService } from "../src/modules/approvals/approval-inbox.service";
import { assertKindPermission, inboxTab, versionFromDate } from "../src/modules/approvals/approval-inbox.rules";

const tenantId = "t1";
const updatedAt = new Date("2026-10-28T04:00:00.000Z");
const expectedVersion = versionFromDate(updatedAt);

function pendingJob(id: string, createdById = "planner") {
  return {
    id,
    woNumber: `WO-2026-0000${id.slice(-1)}`,
    title: `Fix ${id}`,
    priority: "HIGH",
    siteId: "site-1",
    createdById,
    createdAt: updatedAt,
    updatedAt,
    estimatedCost: 1500,
    createdBy: { firstName: "Pat", lastName: "Planner" },
    asset: { name: "Boiler 1" },
    vehicle: null
  };
}

function inboxPrisma(options: { jobs?: unknown[]; approvals?: unknown[] } = {}) {
  const none = () => jest.fn().mockResolvedValue([]);
  return {
    approvalRequest: { findMany: jest.fn().mockResolvedValue(options.approvals ?? []) },
    maintenanceRequest: { findMany: none() },
    partRequest: { findMany: none() },
    vendorQuotation: { findMany: none() },
    vendorInvoice: { findMany: none() },
    vendorRepairCase: { findMany: none() },
    workOrder: {
      // First call: jobs waiting for approval. Later call (by id list): jobs behind approval requests.
      findMany: jest.fn().mockImplementation(({ where }: { where: { id?: unknown } }) =>
        Promise.resolve(where.id ? [] : options.jobs ?? [])
      ),
      findFirst: jest.fn()
    }
  };
}

describe("approval inbox: jobs submitted for approval", () => {
  const manager = { sub: "mgr", tenantId, role: "MANAGER", permissions: [] as string[] };

  it("lists a pending job under Jobs, counts it, and lets a manager decide it", async () => {
    const service = new ApprovalInboxService(inboxPrisma({ jobs: [pendingJob("job-1")] }) as never, {} as never, {} as never);
    const result = await service.list(manager as never, {});
    expect(result.meta.counts).toMatchObject({ all: 1, work_orders: 1 });
    expect(result.items[0]).toMatchObject({
      id: "job-1",
      kind: "work_order",
      tab: "work_orders",
      reference: "WO-2026-00001",
      canDecide: true,
      canReturn: false,
      workOrderId: "job-1"
    });
  });

  it("does not let the person who raised the job approve it", async () => {
    const service = new ApprovalInboxService(inboxPrisma({ jobs: [pendingJob("job-1", "mgr")] }) as never, {} as never, {} as never);
    const result = await service.list(manager as never, {});
    expect(result.items[0].canDecide).toBe(false);
  });

  it("skips a job that already has an approval-rule request (no double row)", async () => {
    const approval = {
      id: "ap-1",
      tenantId,
      subjectEntityType: "WorkOrder",
      subjectEntityId: "job-1",
      processType: "WORK_ORDER_APPROVAL",
      status: "PENDING",
      requestedAt: updatedAt,
      updatedAt,
      createdAt: updatedAt,
      requestedById: "planner",
      requestedBy: { firstName: "Pat", lastName: "Planner" },
      steps: [],
      decisions: [],
      contextSnapshot: null
    };
    const service = new ApprovalInboxService(
      inboxPrisma({ jobs: [pendingJob("job-1")], approvals: [approval] }) as never,
      {} as never,
      {} as never
    );
    const result = await service.list({ ...manager, role: "ADMIN" } as never, {});
    expect(result.items.filter((item) => item.kind === "work_order")).toHaveLength(0);
  });

  it("approves and rejects through the job's own approve / reject actions", async () => {
    const prisma = inboxPrisma();
    prisma.workOrder.findFirst.mockResolvedValue({ id: "job-1", tenantId, createdById: "planner", updatedAt });
    const service = new ApprovalInboxService(prisma as never, {} as never, {} as never);
    const workOrders = { approveWorkOrder: jest.fn().mockResolvedValue({ id: "job-1" }), rejectWorkOrder: jest.fn() };
    (service as unknown as { workOrders: () => Promise<unknown> }).workOrders = async () => workOrders;

    await service.decide({ actor: manager as never, id: "job-1", kind: "work_order", decision: "APPROVED", expectedVersion });
    expect(workOrders.approveWorkOrder).toHaveBeenCalledWith("job-1", undefined, expect.objectContaining({ sub: "mgr" }));

    await service.decide({ actor: manager as never, id: "job-1", kind: "work_order", decision: "REJECTED", reason: "Not needed", expectedVersion });
    expect(workOrders.rejectWorkOrder).toHaveBeenCalledWith("job-1", "Not needed", expect.objectContaining({ sub: "mgr" }));

    await expect(
      service.decide({ actor: manager as never, id: "job-1", kind: "work_order", decision: "RETURNED", reason: "More info", expectedVersion })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses roles that cannot approve jobs and the job's own creator", async () => {
    const prisma = inboxPrisma();
    prisma.workOrder.findFirst.mockResolvedValue({ id: "job-1", tenantId, createdById: "mgr", updatedAt });
    const service = new ApprovalInboxService(prisma as never, {} as never, {} as never);
    await expect(
      service.decide({ actor: { ...manager, role: "TECHNICIAN" } as never, id: "job-1", kind: "work_order", decision: "APPROVED", expectedVersion })
    ).rejects.toThrow(/Admin, Manager or Operations Manager/);
    await expect(service.decide({ actor: manager as never, id: "job-1", kind: "work_order", decision: "APPROVED" })).rejects.toThrow();
  });

  it("maps the kind to the Jobs tab and accepts work_orders.manage as the permission", () => {
    expect(inboxTab({ kind: "work_order" })).toBe("work_orders");
    expect(() => assertKindPermission({ permissions: ["work_orders.manage"] }, "work_order")).not.toThrow();
    expect(() => assertKindPermission({ permissions: ["inventory.view"] }, "work_order")).toThrow();
  });
});
