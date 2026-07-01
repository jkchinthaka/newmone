import type { Employee } from "@prisma/client";

import {
  pickWorkforceEmployeeMatch,
  upsertLinkedWorkforceEmployee,
  upsertWorkforceOnlyEmployee
} from "../src/database/workforce-seed";

describe("workforce seed helpers", () => {
  const linkedEmployee = {
    id: "emp-tech",
    employeeNo: "EMP-0001",
    email: "tech@maintainpro.local",
    linkedUserId: "user-tech",
    canLogin: true
  } as Employee;

  const workforceOnlyEmployee = {
    id: "emp-helper",
    employeeNo: "EMP-0004",
    email: null,
    linkedUserId: null,
    canLogin: false
  } as Employee;

  it("prefers linkedUserId when multiple workforce rows match", () => {
    const picked = pickWorkforceEmployeeMatch([workforceOnlyEmployee, linkedEmployee], {
      linkedUserId: "user-tech",
      employeeNo: "EMP-0001",
      email: "tech@maintainpro.local"
    });

    expect(picked?.id).toBe("emp-tech");
  });

  it("updates linked employee instead of creating duplicate linkedUserId", async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue(linkedEmployee),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({ ...linkedEmployee, designation: "TECHNICIAN" }),
        create: jest.fn()
      }
    };

    await upsertLinkedWorkforceEmployee(prisma as never, {
      tenantId: "tenant-1",
      employeeNo: "EMP-0001",
      fullName: "Field Technician",
      email: "tech@maintainpro.local",
      designation: "TECHNICIAN",
      skills: ["General maintenance"],
      dailyCapacityHours: 8,
      active: true,
      linkedUserId: "user-tech"
    });

    expect(prisma.employee.create).not.toHaveBeenCalled();
    expect(prisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "emp-tech" },
        data: expect.objectContaining({ linkedUserId: "user-tech", canLogin: true })
      })
    );
  });

  it("updates workforce-only employee by employeeNo without linkedUserId", async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([workforceOnlyEmployee]),
        update: jest.fn().mockResolvedValue(workforceOnlyEmployee),
        create: jest.fn()
      }
    };

    await upsertWorkforceOnlyEmployee(prisma as never, {
      tenantId: "tenant-1",
      employeeNo: "EMP-0004",
      fullName: "Ali Helper",
      designation: "HELPER",
      skills: ["Manual handling"],
      dailyCapacityHours: 8,
      active: true,
      canLogin: false
    });

    expect(prisma.employee.create).not.toHaveBeenCalled();
    expect(prisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "emp-helper" },
        data: expect.not.objectContaining({ linkedUserId: expect.anything() })
      })
    );
  });

  it("creates workforce-only employee without linkedUserId when missing", async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "emp-new" })
      }
    };

    await upsertWorkforceOnlyEmployee(prisma as never, {
      tenantId: "tenant-1",
      employeeNo: "EMP-0005",
      fullName: "Raj Maintenance Supervisor",
      designation: "SUPERVISOR",
      skills: ["Team lead"],
      dailyCapacityHours: 8,
      active: true,
      canLogin: false
    });

    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeNo: "EMP-0005",
          canLogin: false
        })
      })
    );
    expect(prisma.employee.create.mock.calls[0][0].data).not.toHaveProperty("linkedUserId");
  });
});
