import { BadRequestException, NotFoundException } from "@nestjs/common";
import { RoleName, WorkOrderStatus } from "@prisma/client";

import { WorkOrderAssigneesService } from "../src/modules/work-orders/work-order-assignees.service";
import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";

describe("legacy technician assignment transaction boundary", () => {
  const lockSql: string[] = [];
  const prisma: Record<string, any> = {
    workOrder: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    user: { findFirst: jest.fn() },
    employee: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
    workOrderAssignee: { delete: jest.fn() },
    auditLog: { create: jest.fn() },
    workOrderStatusHistory: { create: jest.fn() },
    $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
      lockSql.push(strings.join(" "));
      return [{ id: "locked", active: true, canReceiveWorkOrders: true, availabilityStatus: "AVAILABLE" }];
    }),
    $transaction: jest.fn()
  };
  prisma.$transaction.mockImplementation(async (fn: (db: unknown) => Promise<unknown>) => fn(prisma));
  const assignees = {
    prepareAssignee: jest.fn(),
    persistAssignee: jest.fn(),
    removeAssignee: jest.fn()
  };
  const notifications = { createNotification: jest.fn() };
  const service = new WorkOrdersService(
    prisma as never,
    notifications as never,
    {} as never,
    {} as never,
    assignees as unknown as WorkOrderAssigneesService
  );
  const actor = { sub: "mgr-1", email: "m@test.local", role: RoleName.MANAGER, tenantId: "tenant-1" };

  beforeEach(() => {
    jest.clearAllMocks();
    lockSql.length = 0;
    prisma.$transaction.mockImplementation(async (fn: (db: unknown) => Promise<unknown>) => fn(prisma));
    prisma.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
      lockSql.push(strings.join(" "));
      return [{ id: "locked", active: true, canReceiveWorkOrders: true, availabilityStatus: "AVAILABLE" }];
    });
    prisma.workOrder.findFirst.mockResolvedValue({
      id: "wo-1",
      tenantId: "tenant-1",
      status: WorkOrderStatus.PLANNED,
      approvalStatus: "APPROVED",
      technicianId: null,
      woNumber: "WO-1",
      priority: "MEDIUM"
    });
    prisma.user.findFirst.mockResolvedValue({
      id: "tech-1",
      email: "tech@test.local",
      firstName: "Sam",
      lastName: "Tech",
      role: { name: RoleName.TECHNICIAN }
    });
    prisma.employee.findFirst.mockResolvedValue({
      id: "emp-1",
      designation: "Technician",
      linkedUserId: "tech-1",
      active: true,
      availabilityStatus: "AVAILABLE"
    });
    prisma.employee.create.mockResolvedValue({
      id: "emp-new",
      designation: "Technician",
      linkedUserId: "tech-1"
    });
    prisma.workOrder.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    prisma.workOrderStatusHistory.create.mockResolvedValue({});
    notifications.createNotification.mockResolvedValue({});
    assignees.prepareAssignee.mockResolvedValue({});
    assignees.persistAssignee.mockResolvedValue({ id: "assign-1" });
  });

  it("assigns an eligible employee inside one transaction and notifies only after it commits", async () => {
    let committed = false;
    prisma.$transaction.mockImplementation(async (fn: (db: unknown) => Promise<unknown>) => {
      const result = await fn(prisma);
      committed = true;
      return result;
    });
    notifications.createNotification.mockImplementation(async () => {
      expect(committed).toBe(true);
    });

    await service.assign("wo-1", "tech-1", actor);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(assignees.persistAssignee).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        employee: expect.objectContaining({ id: "emp-1" }),
        input: { employeeId: "emp-1", isPrimary: true }
      }),
      actor,
      { deferTechnicianLink: true }
    );
    expect(prisma.workOrder.update).toHaveBeenCalledWith({
      where: { id: "wo-1" },
      data: expect.objectContaining({ technicianId: "tech-1", status: WorkOrderStatus.ASSIGNED })
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(prisma.workOrderStatusHistory.create).toHaveBeenCalled();
    expect(lockSql[0]).toContain("[User]");
    expect(lockSql[1]).toContain("[WorkOrder]");
    expect(assignees.persistAssignee.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.workOrder.update.mock.invocationCallOrder[0]
    );
    expect(notifications.createNotification.mock.invocationCallOrder[0]).toBeGreaterThan(
      prisma.$transaction.mock.invocationCallOrder[0]
    );
    expect(prisma.workOrderAssignee.delete).not.toHaveBeenCalled();
    expect(prisma.employee.delete).not.toHaveBeenCalled();
  });

  it("does not open a transaction when the employee is not eligible", async () => {
    assignees.prepareAssignee.mockRejectedValue(
      new BadRequestException("Employee availability is unknown and cannot be assigned.")
    );

    await expect(service.assign("wo-1", "tech-1", actor)).rejects.toThrow(/unknown/);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.workOrder.update).not.toHaveBeenCalled();
    expect(prisma.employee.create).not.toHaveBeenCalled();
    expect(assignees.persistAssignee).not.toHaveBeenCalled();
    expect(prisma.workOrderAssignee.delete).not.toHaveBeenCalled();
  });

  it("keeps a rejected work-order update in the same transaction callback and does not compensate with deletes", async () => {
    prisma.workOrder.update.mockRejectedValue(new Error("write failed"));

    await expect(service.assign("wo-1", "tech-1", actor)).rejects.toThrow("write failed");

    expect(assignees.persistAssignee).toHaveBeenCalled();
    expect(prisma.workOrderAssignee.delete).not.toHaveBeenCalled();
    expect(prisma.employee.delete).not.toHaveBeenCalled();
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it("creates a missing employee inside the transaction and does not delete it from application code when a later write fails", async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    assignees.persistAssignee.mockRejectedValue(new Error("assignee write failed"));

    await expect(service.assign("wo-1", "tech-1", actor)).rejects.toThrow("assignee write failed");

    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availabilityStatus: "AVAILABLE",
          linkedUserId: "tech-1",
          tenantId: "tenant-1"
        })
      })
    );
    expect(prisma.employee.delete).not.toHaveBeenCalled();
    expect(prisma.workOrder.update).not.toHaveBeenCalled();
  });

  it("plans and assigns an approved open work order in one transaction", async () => {
    prisma.workOrder.findFirst.mockResolvedValue({
      id: "wo-1",
      tenantId: "tenant-1",
      status: WorkOrderStatus.OPEN,
      approvalStatus: "APPROVED",
      technicianId: null,
      woNumber: "WO-1",
      priority: "MEDIUM"
    });

    await service.assign("wo-1", "tech-1", actor);

    const histories = prisma.workOrderStatusHistory.create.mock.calls.map(
      (call: [{ data: { fromStatus: string; toStatus: string } }]) =>
        `${call[0].data.fromStatus}->${call[0].data.toStatus}`
    );
    expect(histories).toEqual(["OPEN->PLANNED", "PLANNED->ASSIGNED"]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "tech-1", title: "Work order assigned" })
    );
  });

  it("blocks a technician from another tenant before any assignment write", async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.assign("wo-1", "tech-1", actor)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "tech-1", tenantId: "tenant-1" }) })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(assignees.persistAssignee).not.toHaveBeenCalled();
  });
});
