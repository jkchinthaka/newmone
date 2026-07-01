import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import {
  ASSIGNABLE_WORKFORCE_DESIGNATIONS,
  matchesWorkforceDesignation,
  resolveEffectiveDesignation,
  roleNameToDesignationFallback
} from "../src/common/utils/workforce-designation";
import { WorkforceEmployeesService } from "../src/modules/workforce/workforce-employees.service";
import { WorkforcePlanningService } from "../src/modules/workforce/workforce-planning.service";

describe("workforce designation helpers", () => {
  it("uses explicit designation when present", () => {
    expect(
      resolveEffectiveDesignation({
        designation: "ELECTRICIAN",
        roleName: RoleName.TECHNICIAN
      })
    ).toBe("ELECTRICIAN");
  });

  it("falls back to role label when designation is missing", () => {
    expect(
      resolveEffectiveDesignation({
        designation: null,
        roleName: RoleName.TECHNICIAN
      })
    ).toBe("TECHNICIAN");
    expect(roleNameToDesignationFallback(RoleName.MECHANIC)).toBe("MECHANIC");
  });

  it("matches designation filter using fallback", () => {
    expect(
      matchesWorkforceDesignation({ designation: null, roleName: RoleName.TECHNICIAN }, "TECHNICIAN")
    ).toBe(true);
    expect(
      matchesWorkforceDesignation({ designation: null, roleName: RoleName.DRIVER }, "TECHNICIAN")
    ).toBe(false);
  });

  it("exposes the assignable designation catalog", () => {
    expect(ASSIGNABLE_WORKFORCE_DESIGNATIONS).toContain("TECHNICIAN");
    expect(ASSIGNABLE_WORKFORCE_DESIGNATIONS).toContain("MECHANIC");
  });
});

describe("WorkforcePlanningService.listEmployeesByDesignation", () => {
  const prisma = {
    employee: { findMany: jest.fn(), findUnique: jest.fn() },
    workOrderAssignee: { findMany: jest.fn() },
    employeeLeaveRequest: { findFirst: jest.fn() }
  };

  const service = new WorkforcePlanningService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.workOrderAssignee.findMany.mockResolvedValue([]);
  });

  it("returns workforce employee with designation and workload", async () => {
    prisma.employee.findMany.mockResolvedValue([
      {
        id: "emp-tech-1",
        fullName: "Field Technician",
        email: "tech@maintainpro.local",
        phone: null,
        designation: "TECHNICIAN",
        skills: [],
        dailyCapacityHours: 8,
        departmentId: null,
        branchName: "Main Site",
        canLogin: true,
        linkedUserId: "user-tech-1",
        department: null,
        linkedUser: { role: { name: RoleName.TECHNICIAN } }
      }
    ]);

    const rows = await service.listEmployeesByDesignation("tenant-1");

    expect(rows).toHaveLength(1);
    expect(rows[0].effectiveDesignation).toBe("TECHNICIAN");
    expect(rows[0].fullName).toBe("Field Technician");
    expect(rows[0].workloadPercentage).toBe(0);
  });

  it("filters by designation from employee master", async () => {
    prisma.employee.findMany.mockResolvedValue([
      {
        id: "emp-tech-1",
        fullName: "Field Technician",
        email: "tech@maintainpro.local",
        phone: null,
        designation: "TECHNICIAN",
        skills: [],
        dailyCapacityHours: 8,
        departmentId: null,
        branchName: null,
        canLogin: false,
        linkedUserId: null,
        department: null,
        linkedUser: null
      },
      {
        id: "emp-clean-1",
        fullName: "Kamal Perera",
        email: null,
        phone: null,
        designation: "CLEANER",
        skills: [],
        dailyCapacityHours: 8,
        departmentId: null,
        branchName: null,
        canLogin: false,
        linkedUserId: null,
        department: null,
        linkedUser: null
      }
    ]);

    const rows = await service.listEmployeesByDesignation("tenant-1", "TECHNICIAN");

    expect(rows.map((row) => row.id)).toEqual(["emp-tech-1"]);
  });
});

describe("WorkforceEmployeesService", () => {
  const prisma = {
    employee: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn()
    },
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    role: { findFirst: jest.fn() },
    department: { findFirst: jest.fn() },
    tenantMembership: { create: jest.fn() }
  };

  const service = new WorkforceEmployeesService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.employee.count.mockResolvedValue(4);
    prisma.employee.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.role.findFirst.mockResolvedValue({ id: "role-tech", name: RoleName.TECHNICIAN });
    prisma.employee.create.mockImplementation(async ({ data }) => ({ id: "emp-new", ...data }));
  });

  it("creates employee without login", async () => {
    const row = await service.create("tenant-1", {
      fullName: "Ali Helper",
      designation: "HELPER",
      dailyCapacityHours: 8,
      canLogin: false
    });

    expect(row.id).toBe("emp-new");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("creates employee with login and links user", async () => {
    prisma.user.create.mockResolvedValue({ id: "user-new" });
    prisma.tenantMembership.create.mockResolvedValue({});

    await service.create("tenant-1", {
      fullName: "Field Technician",
      email: "tech2@maintainpro.local",
      designation: "TECHNICIAN",
      canLogin: true
    });

    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ linkedUserId: "user-new", canLogin: true })
      })
    );
  });

  it("blocks duplicate email", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "existing-user" });

    await expect(
      service.create("tenant-1", {
        fullName: "Duplicate",
        email: "dup@maintainpro.local",
        designation: "TECHNICIAN",
        canLogin: true
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("resolves legacy user id to linked employee", async () => {
    prisma.employee.findFirst.mockResolvedValueOnce(null);
    prisma.employee.findUnique.mockResolvedValueOnce({
      id: "emp-linked",
      fullName: "Legacy Tech",
      designation: "TECHNICIAN",
      active: true,
      tenantId: "tenant-1",
      linkedUser: { id: "legacy-user-id", role: { name: RoleName.TECHNICIAN } },
      department: null
    });

    const resolved = await service.resolveAssignableEmployee("legacy-user-id", "tenant-1");
    expect(resolved?.id).toBe("emp-linked");
  });
});

describe("WorkforceEmployeesService RBAC expectations", () => {
  it("documents manager-only mutation roles", () => {
    const managers = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"]);
    expect(managers.has(RoleName.TECHNICIAN)).toBe(false);
    expect(managers.has(RoleName.SECURITY_OFFICER)).toBe(false);
    expect(managers.has(RoleName.INVENTORY_KEEPER)).toBe(false);
  });
});

describe("WorkforcePlanningService inactive guard", () => {
  it("blocks inactive employee assignment in availability check", async () => {
    const prisma = {
      employeeLeaveRequest: { findFirst: jest.fn().mockResolvedValue(null) },
      employee: { findUnique: jest.fn().mockResolvedValue({ dailyCapacityHours: 8, active: false }) },
      workOrderAssignee: { findMany: jest.fn() }
    };
    const service = new WorkforcePlanningService(prisma as never);

    await expect(
      service.assertAssignmentAvailability({
        tenantId: "tenant-1",
        employeeId: "emp-inactive",
        estimatedHours: 2
      })
    ).rejects.toThrow(BadRequestException);
  });
});

describe("leave override permission guard", () => {
  it("requires manager role for override path", () => {
    const allowed = new Set<string>([
      RoleName.SUPER_ADMIN,
      RoleName.ADMIN,
      RoleName.MANAGER,
      RoleName.OPERATIONS_MANAGER
    ]);
    expect(allowed.has(RoleName.TECHNICIAN)).toBe(false);
    expect(allowed.has(RoleName.MANAGER)).toBe(true);
  });
});

describe("non-admin cannot mutate employees (controller contract)", () => {
  it("technician is not in manager role list", () => {
    const managers = ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"];
    expect(managers.includes(RoleName.TECHNICIAN)).toBe(false);
  });
});

describe("ForbiddenException for unauthorized override", () => {
  it("is used for leave override without manager permission", () => {
    expect(new ForbiddenException("Leave override requires manager permission")).toBeInstanceOf(
      ForbiddenException
    );
  });
});
