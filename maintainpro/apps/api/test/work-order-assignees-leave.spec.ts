import { BadRequestException } from "@nestjs/common";
import { LeaveRequestStatus, RoleName, WorkOrderStatus } from "@prisma/client";

import { WorkOrderAssigneesService } from "../src/modules/work-orders/work-order-assignees.service";
import { WorkforcePlanningService } from "../src/modules/workforce/workforce-planning.service";

describe("WorkOrderAssigneesService leave conflict", () => {
  const prisma = {
    workOrder: {
      findFirst: jest.fn(),
      update: jest.fn()
    },
    user: { findFirst: jest.fn(), findUnique: jest.fn() },
    workOrderAssignee: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
      findFirst: jest.fn()
    },
    employeeLeaveRequest: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() }
  };

  const workforce = new WorkforcePlanningService(prisma as never);
  const service = new WorkOrderAssigneesService(prisma as never, workforce);

  const manager = { sub: "mgr-1", email: "m@test.local", role: RoleName.MANAGER, tenantId: "tenant-1" };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.workOrder.findFirst.mockResolvedValue({
      id: "wo-1",
      tenantId: "tenant-1",
      status: WorkOrderStatus.OPEN,
      technicianId: null
    });
    prisma.user.findFirst.mockResolvedValue({
      id: "emp-1",
      designation: "Electrician",
      role: { name: RoleName.TECHNICIAN }
    });
    prisma.user.findUnique.mockResolvedValue({ dailyCapacityHours: 8 });
    prisma.workOrderAssignee.findUnique.mockResolvedValue(null);
    prisma.workOrderAssignee.findMany.mockResolvedValue([]);
    prisma.workOrderAssignee.updateMany.mockResolvedValue({ count: 0 });
    prisma.workOrderAssignee.upsert.mockResolvedValue({
      id: "assign-1",
      employeeId: "emp-1",
      designation: "Electrician",
      plannedStartAt: null,
      plannedEndAt: null
    });
    prisma.workOrder.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    prisma.employeeLeaveRequest.findFirst.mockResolvedValue({
      id: "leave-1",
      status: LeaveRequestStatus.APPROVED
    });
  });

  it("blocks assignment on approved leave without override", async () => {
    await expect(
      service.addAssignee(
        "wo-1",
        { employeeId: "emp-1", designation: "Electrician", estimatedHours: 2 },
        manager
      )
    ).rejects.toThrow(BadRequestException);
  });

  it("allows manager leave override with audit path and reason", async () => {
    const result = await service.addAssignee(
      "wo-1",
      {
        employeeId: "emp-1",
        designation: "Electrician",
        estimatedHours: 2,
        leaveOverride: true,
        leaveOverrideReason: "Emergency pump repair"
      },
      manager
    );

    expect(result.id).toBe("assign-1");
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("prevents duplicate active assignee", async () => {
    prisma.employeeLeaveRequest.findFirst.mockResolvedValue(null);
    prisma.workOrderAssignee.findUnique.mockResolvedValue({
      id: "assign-existing",
      assignmentStatus: "ASSIGNED"
    });

    await expect(
      service.addAssignee(
        "wo-1",
        {
          employeeId: "emp-1",
          estimatedHours: 2,
          plannedStartAt: "2026-06-12T08:00:00.000Z",
          plannedEndAt: "2026-06-12T12:00:00.000Z"
        },
        manager
      )
    ).rejects.toThrow(BadRequestException);
  });

  it("requires planned end after planned start", async () => {
    prisma.employeeLeaveRequest.findFirst.mockResolvedValue(null);
    prisma.workOrderAssignee.findUnique.mockResolvedValue(null);

    await expect(
      service.addAssignee(
        "wo-1",
        {
          employeeId: "emp-1",
          estimatedHours: 2,
          plannedStartAt: "2026-06-12T12:00:00.000Z",
          plannedEndAt: "2026-06-12T08:00:00.000Z"
        },
        manager
      )
    ).rejects.toThrow(BadRequestException);
  });

  it("requires estimated hours greater than zero", async () => {
    prisma.employeeLeaveRequest.findFirst.mockResolvedValue(null);
    prisma.workOrderAssignee.findUnique.mockResolvedValue(null);

    await expect(
      service.addAssignee(
        "wo-1",
        {
          employeeId: "emp-1",
          estimatedHours: 0,
          plannedStartAt: "2026-06-12T08:00:00.000Z",
          plannedEndAt: "2026-06-12T12:00:00.000Z"
        },
        manager
      )
    ).rejects.toThrow(BadRequestException);
  });
});
