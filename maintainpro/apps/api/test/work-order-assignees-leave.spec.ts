import { BadRequestException } from "@nestjs/common";
import { LeaveRequestStatus, RoleName, WorkOrderStatus } from "@prisma/client";

import { WorkOrderAssigneesService } from "../src/modules/work-orders/work-order-assignees.service";
import { WorkforceEmployeesService } from "../src/modules/workforce/workforce-employees.service";
import { WorkforcePlanningService } from "../src/modules/workforce/workforce-planning.service";

describe("WorkOrderAssigneesService leave conflict", () => {
  const prisma = {
    workOrder: {
      findFirst: jest.fn(),
      update: jest.fn()
    },
    employee: { findUnique: jest.fn(), findFirst: jest.fn() },
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
  const workforceEmployees = new WorkforceEmployeesService(prisma as never);
  jest.spyOn(workforceEmployees, "resolveAssignableEmployee");
  const service = new WorkOrderAssigneesService(prisma as never, workforce, workforceEmployees);

  const manager = { sub: "mgr-1", email: "m@test.local", role: RoleName.MANAGER, tenantId: "tenant-1" };

  const activeEmployee = {
    id: "emp-1",
    fullName: "Sam Electrician",
    designation: "ELECTRICIAN",
    linkedUserId: null,
    active: true,
    linkedUser: null,
    department: null
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.workOrder.findFirst.mockResolvedValue({
      id: "wo-1",
      tenantId: "tenant-1",
      status: WorkOrderStatus.OPEN,
      technicianId: null
    });
    jest.spyOn(workforceEmployees, "resolveAssignableEmployee").mockResolvedValue(activeEmployee as never);
    prisma.employee.findUnique.mockResolvedValue({ dailyCapacityHours: 8, active: true });
    prisma.workOrderAssignee.findUnique.mockResolvedValue(null);
    prisma.workOrderAssignee.findMany.mockResolvedValue([]);
    prisma.workOrderAssignee.updateMany.mockResolvedValue({ count: 0 });
    prisma.workOrderAssignee.upsert.mockResolvedValue({
      id: "assign-1",
      employeeId: "emp-1",
      designation: "ELECTRICIAN",
      plannedStartAt: null,
      plannedEndAt: null,
      employee: { fullName: "Sam Electrician", designation: "ELECTRICIAN" }
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
        { employeeId: "emp-1", designation: "ELECTRICIAN", estimatedHours: 2 },
        manager
      )
    ).rejects.toThrow(BadRequestException);
  });

  it("allows manager leave override with audit path and reason", async () => {
    const result = await service.addAssignee(
      "wo-1",
      {
        employeeId: "emp-1",
        designation: "ELECTRICIAN",
        estimatedHours: 2,
        leaveOverride: true,
        leaveOverrideReason: "Emergency pump repair"
      },
      manager
    );

    expect(result.id).toBe("assign-1");
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("assigns employee without login using workforce employee id", async () => {
    prisma.employeeLeaveRequest.findFirst.mockResolvedValue(null);

    await service.addAssignee(
      "wo-1",
      {
        employeeId: "emp-1",
        designation: "ELECTRICIAN",
        estimatedHours: 2,
        plannedStartAt: "2026-06-12T08:00:00.000Z",
        plannedEndAt: "2026-06-12T12:00:00.000Z"
      },
      manager
    );

    expect(workforceEmployees.resolveAssignableEmployee).toHaveBeenCalledWith("emp-1", "tenant-1");
    expect(prisma.workOrderAssignee.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ employeeId: "emp-1" })
      })
    );
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
