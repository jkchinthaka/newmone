import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EmployeeAvailabilityStatus, RoleName, WorkOrderStatus } from "@prisma/client";

import { isAssignmentEmployeeListQuery } from "../src/common/utils/workforce-designation";
import { WORKFORCE_EMPLOYEE_READERS } from "../src/modules/workforce/workforce.controller";
import { WorkforceEmployeesService } from "../src/modules/workforce/workforce-employees.service";
import { WorkforcePlanningService } from "../src/modules/workforce/workforce-planning.service";
import { WorkOrderAssigneesService } from "../src/modules/work-orders/work-order-assignees.service";

function employeeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "emp-1",
    fullName: "Sam Electrician",
    email: null,
    phone: null,
    designation: "ELECTRICIAN",
    skills: null,
    dailyCapacityHours: 8,
    departmentId: null,
    branchName: null,
    canLogin: false,
    linkedUserId: null,
    active: true,
    canReceiveWorkOrders: true,
    availabilityStatus: "AVAILABLE",
    tenantId: "tenant-1",
    department: null,
    linkedUser: null,
    ...overrides
  };
}

describe("assignment employee list query", () => {
  it("uses the eligible list for an empty designation and keeps general search on findAll", () => {
    expect(isAssignmentEmployeeListQuery({ designation: "" })).toBe(true);
    expect(isAssignmentEmployeeListQuery({ designation: "ELECTRICIAN" })).toBe(true);
    expect(isAssignmentEmployeeListQuery({})).toBe(false);
    expect(isAssignmentEmployeeListQuery({ designation: "ELECTRICIAN", q: "sam" })).toBe(false);
    expect(isAssignmentEmployeeListQuery({ designation: "ELECTRICIAN", active: "true" })).toBe(false);
  });

  it("does not grant the employee list to an unauthorized role", () => {
    expect(WORKFORCE_EMPLOYEE_READERS).toEqual(
      expect.arrayContaining(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "MECHANIC"])
    );
    expect(WORKFORCE_EMPLOYEE_READERS).not.toContain("VIEWER");
    expect(WORKFORCE_EMPLOYEE_READERS).not.toContain("TECHNICIAN");
  });
});

describe("WorkforcePlanningService.listEmployeesByDesignation", () => {
  const prisma = {
    employee: { findMany: jest.fn() },
    workOrderAssignee: { findMany: jest.fn() }
  };
  const service = new WorkforcePlanningService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.workOrderAssignee.findMany.mockResolvedValue([]);
  });

  it("returns eligible employees past the first 100 and excludes inactive, blocked, and unavailable rows in the query", async () => {
    const rows = Array.from({ length: 101 }, (_, index) =>
      employeeRow({ id: `emp-${index}`, fullName: `Tech ${index}`, designation: "ELECTRICIAN" })
    );
    prisma.employee.findMany.mockResolvedValue(rows);

    const result = await service.listEmployeesByDesignation("tenant-1", "ELECTRICIAN");

    expect(result).toHaveLength(101);
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          active: true,
          canReceiveWorkOrders: true,
          availabilityStatus: EmployeeAvailabilityStatus.AVAILABLE,
          tenantId: "tenant-1"
        }
      })
    );
    expect(prisma.employee.findMany.mock.calls[0][0].take).toBeUndefined();
    expect(result[0].availabilityLabel).toBe("Available");
    expect(result[0].workloadPercentage).toBe(0);
  });

  it("matches a blank designation through the linked role and hides a different designation", async () => {
    prisma.employee.findMany.mockResolvedValue([
      employeeRow({
        id: "role-tech",
        designation: null,
        linkedUser: { role: { name: RoleName.TECHNICIAN } }
      }),
      employeeRow({ id: "helper", designation: "HELPER" })
    ]);

    const technicians = await service.listEmployeesByDesignation("tenant-1", "TECHNICIAN");
    expect(technicians.map((row) => row.id)).toEqual(["role-tech"]);

    prisma.employee.findMany.mockResolvedValue([
      employeeRow({
        id: "role-tech",
        designation: null,
        linkedUser: { role: { name: RoleName.TECHNICIAN } }
      })
    ]);
    const electricians = await service.listEmployeesByDesignation("tenant-1", "ELECTRICIAN");
    expect(electricians).toEqual([]);
  });
});

describe("assignment eligibility at the assignee boundary", () => {
  const prisma = {
    workOrder: { findFirst: jest.fn(), update: jest.fn() },
    employee: { findUnique: jest.fn(), findFirst: jest.fn() },
    workOrderAssignee: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn()
    },
    employeeLeaveRequest: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: (fn: (db: unknown) => Promise<unknown>) => fn(prisma),
    $queryRaw: async () => [{ id: "wo-1" }]
  };
  const workforce = new WorkforcePlanningService(prisma as never);
  const workforceEmployees = new WorkforceEmployeesService(prisma as never);
  const service = new WorkOrderAssigneesService(prisma as never, workforce, workforceEmployees);
  const manager = { sub: "mgr-1", email: "m@test.local", role: RoleName.MANAGER, tenantId: "tenant-1" };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.workOrder.findFirst.mockResolvedValue({
      id: "wo-1",
      tenantId: "tenant-1",
      status: WorkOrderStatus.OPEN,
      approvalStatus: "APPROVED",
      technicianId: null
    });
  });

  it("rejects an inactive employee", async () => {
    prisma.employee.findFirst.mockImplementation(async (args: { where?: { active?: boolean } }) => {
      if (args.where?.active === true) return null;
      return { active: false, tenantId: "tenant-1" };
    });

    await expect(service.addAssignee("wo-1", { employeeId: "emp-1" }, manager)).rejects.toThrow(
      "Inactive employees cannot be assigned"
    );
  });

  it("rejects an employee who cannot receive work orders", async () => {
    prisma.employee.findFirst.mockResolvedValue(employeeRow({ canReceiveWorkOrders: false }));

    await expect(service.addAssignee("wo-1", { employeeId: "emp-1" }, manager)).rejects.toThrow(
      "Employee cannot receive work orders"
    );
  });

  it("blocks ON_LEAVE until a manager supplies the leave override", async () => {
    prisma.employee.findFirst.mockResolvedValue(employeeRow({ availabilityStatus: "ON_LEAVE" }));
    prisma.employeeLeaveRequest.findFirst.mockResolvedValue(null);
    prisma.employee.findUnique.mockResolvedValue({ dailyCapacityHours: 8, active: true });
    prisma.workOrderAssignee.findUnique.mockResolvedValue(null);
    prisma.workOrderAssignee.findMany.mockResolvedValue([]);

    await expect(
      service.addAssignee(
        "wo-1",
        { employeeId: "emp-1", plannedStartAt: "2026-10-14T08:00:00.000Z", estimatedHours: 1 },
        manager
      )
    ).rejects.toThrow("Employee is on leave. Use leave override with manager permission to proceed.");

    prisma.workOrderAssignee.upsert.mockResolvedValue({ id: "assign-1", employeeId: "emp-1" });
    prisma.workOrder.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    await expect(
      service.addAssignee(
        "wo-1",
        {
          employeeId: "emp-1",
          plannedStartAt: "2026-10-14T08:00:00.000Z",
          estimatedHours: 1,
          leaveOverride: true,
          leaveOverrideReason: "Cover the shift"
        },
        manager
      )
    ).resolves.toMatchObject({ id: "assign-1" });
  });

  it("does not clear other primary flags when the employee is already on the work order", async () => {
    prisma.employee.findFirst.mockResolvedValue(employeeRow());
    prisma.workOrderAssignee.findUnique.mockResolvedValue({
      id: "assign-existing",
      assignmentStatus: "ASSIGNED"
    });

    await expect(
      service.persistAssignee(prisma as never, {
        workOrder: { id: "wo-1", tenantId: "tenant-1", technicianId: null },
        employee: { id: "emp-1", designation: "ELECTRICIAN", linkedUserId: null },
        input: { employeeId: "emp-1", isPrimary: true },
        plannedStartAt: null,
        plannedEndAt: null
      }, manager)
    ).rejects.toThrow("Employee is already assigned to this work order");

    expect(prisma.workOrderAssignee.updateMany).not.toHaveBeenCalled();
    expect(prisma.workOrderAssignee.upsert).not.toHaveBeenCalled();
  });

  it("rejects an unavailable employee and an employee with unknown availability", async () => {
    prisma.employee.findFirst.mockResolvedValueOnce(employeeRow({ availabilityStatus: "UNAVAILABLE" }));
    await expect(service.addAssignee("wo-1", { employeeId: "emp-1" }, manager)).rejects.toThrow(
      "Employee is not available for assignment (UNAVAILABLE)."
    );

    prisma.employee.findFirst.mockResolvedValueOnce(employeeRow({ availabilityStatus: "" }));
    await expect(service.addAssignee("wo-1", { employeeId: "emp-2" }, manager)).rejects.toThrow(
      "Employee availability is unknown and cannot be assigned."
    );
  });

  it("rejects a designation that does not match the employee or the role fallback", async () => {
    prisma.employee.findFirst.mockResolvedValue(employeeRow({ designation: "HELPER" }));
    await expect(
      service.addAssignee("wo-1", { employeeId: "emp-1", designation: "ELECTRICIAN" }, manager)
    ).rejects.toThrow(BadRequestException);

    prisma.employee.findFirst.mockResolvedValue(
      employeeRow({
        designation: null,
        linkedUser: { id: "user-1", role: { name: RoleName.TECHNICIAN } }
      })
    );
    await expect(
      service.addAssignee("wo-1", { employeeId: "emp-1", designation: "ELECTRICIAN" }, manager)
    ).rejects.toThrow(/does not match required "ELECTRICIAN"/);
  });

  it("accepts a role-fallback designation and does not leak another tenant", async () => {
    const eligible = employeeRow({
      designation: null,
      linkedUser: { id: "user-1", role: { name: RoleName.TECHNICIAN } }
    });
    prisma.employee.findFirst.mockResolvedValue(eligible);
    await expect(
      workforceEmployees.assertEligibleForAssignment("emp-1", "tenant-1", "TECHNICIAN")
    ).resolves.toMatchObject({ id: "emp-1" });

    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(workforceEmployees.assertEligibleForAssignment("emp-9", "tenant-2")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-2" })
      })
    );
  });
});
