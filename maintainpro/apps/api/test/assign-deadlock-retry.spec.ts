import { RoleName, WorkOrderApprovalStatus, WorkOrderStatus } from "@prisma/client";

import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";

describe("assign retries SQL Server deadlocks", () => {
  const actor = {
    sub: "manager-1",
    email: "manager@maintainpro.local",
    role: RoleName.MANAGER,
    tenantId: "tenant-a"
  };

  it("runs the assign transaction again after error 1205 and keeps a 547", async () => {
    const workOrder = {
      id: "wo-1",
      tenantId: "tenant-a",
      woNumber: "WO-1",
      status: WorkOrderStatus.PLANNED,
      approvalStatus: WorkOrderApprovalStatus.APPROVED,
      technicianId: null,
      version: 1,
      dueDate: null,
      priority: "MEDIUM"
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: "emp-1",
          version: 1,
          active: true,
          canReceiveWorkOrders: true,
          availabilityStatus: "AVAILABLE"
        }
      ]),
      employee: { findFirst: jest.fn(), create: jest.fn() },
      workOrder: { update: jest.fn().mockResolvedValue({}), updateMany: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      workOrderStatusHistory: { create: jest.fn().mockResolvedValue({}) }
    };
    let attempts = 0;
    const prisma = {
      workOrder: { findFirst: jest.fn().mockResolvedValue(workOrder) },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: "tech-1",
          tenantId: "tenant-a",
          firstName: "Tech",
          lastName: "Nician",
          email: "tech@maintainpro.local",
          role: { name: RoleName.TECHNICIAN }
        })
      },
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: "emp-1",
          designation: "Technician",
          linkedUserId: "tech-1",
          active: true
        })
      },
      workOrderAssignee: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (run: (client: typeof tx) => Promise<void>) => {
        attempts += 1;
        if (attempts === 1) {
          throw Object.assign(new Error("deadlock victim. Rerun the transaction."), { number: 1205 });
        }
        return run(tx);
      })
    };
    const notifications = { createNotification: jest.fn().mockResolvedValue({}) };
    const assignees = {
      prepareAssignee: jest.fn().mockResolvedValue(undefined),
      persistAssignee: jest.fn().mockResolvedValue(undefined)
    };
    const service = new WorkOrdersService(
      prisma as never,
      notifications as never,
      {} as never,
      {} as never,
      assignees as never
    );

    const updated = await service.assign("wo-1", "tech-1", actor);

    expect(attempts).toBe(2);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(updated.woNumber).toBe("WO-1");

    attempts = 0;
    prisma.$transaction.mockImplementation(async () => {
      attempts += 1;
      throw Object.assign(new Error("constraint"), { number: 547 });
    });
    await expect(service.assign("wo-1", "tech-1", actor)).rejects.toMatchObject({ number: 547 });
    expect(attempts).toBe(1);
  });
});
