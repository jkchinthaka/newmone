import { RoleName } from "@prisma/client";

import {
  ASSIGNABLE_WORKFORCE_DESIGNATIONS,
  matchesWorkforceDesignation,
  resolveEffectiveDesignation,
  roleNameToDesignationFallback
} from "../src/common/utils/workforce-designation";
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
    user: { findMany: jest.fn() },
    workOrderAssignee: { findMany: jest.fn() },
    employeeLeaveRequest: { findFirst: jest.fn() }
  };

  const service = new WorkforcePlanningService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.workOrderAssignee.findMany.mockResolvedValue([]);
  });

  it("returns seeded technician with effective designation and workload", async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: "tech-1",
        firstName: "Field",
        lastName: "Technician",
        email: "tech@maintainpro.local",
        designation: "TECHNICIAN",
        skills: [],
        dailyCapacityHours: 8,
        departmentId: null,
        role: { name: RoleName.TECHNICIAN }
      }
    ]);

    const rows = await service.listEmployeesByDesignation("tenant-1");

    expect(rows).toHaveLength(1);
    expect(rows[0].effectiveDesignation).toBe("TECHNICIAN");
    expect(rows[0].email).toBe("tech@maintainpro.local");
    expect(rows[0].workloadPercentage).toBe(0);
  });

  it("filters by designation including role fallback", async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: "tech-1",
        firstName: "Field",
        lastName: "Technician",
        email: "tech@maintainpro.local",
        designation: null,
        skills: [],
        dailyCapacityHours: 8,
        departmentId: null,
        role: { name: RoleName.TECHNICIAN }
      },
      {
        id: "clean-1",
        firstName: "Kamal",
        lastName: "Perera",
        email: "cleaner@maintainpro.local",
        designation: "CLEANER",
        skills: [],
        dailyCapacityHours: 8,
        departmentId: null,
        role: { name: RoleName.CLEANER }
      }
    ]);

    const rows = await service.listEmployeesByDesignation("tenant-1", "TECHNICIAN");

    expect(rows.map((row) => row.id)).toEqual(["tech-1"]);
  });
});
