import { BadRequestException } from "@nestjs/common";

import { workforceMasterAvailability } from "../src/common/utils/workforce-availability";
import { WorkforceEmployeesService } from "../src/modules/workforce/workforce-employees.service";

describe("workforce master creation availability", () => {
  it("stores an omitted status as AVAILABLE and rejects blank or unknown values", () => {
    expect(workforceMasterAvailability(undefined)).toBe("AVAILABLE");
    expect(workforceMasterAvailability("on_leave")).toBe("ON_LEAVE");
    expect(() => workforceMasterAvailability("")).toThrow(BadRequestException);
    expect(() => workforceMasterAvailability("   ")).toThrow(BadRequestException);
    expect(() => workforceMasterAvailability("UNKNOWN")).toThrow(/not treated as available/);
  });

  it("persists the explicit status on Workforce Master create", async () => {
    const prisma = {
      employee: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: "emp-new", ...data }))
      },
      department: { findFirst: jest.fn() }
    };
    const service = new WorkforceEmployeesService(prisma as never);

    const created = await service.create("tenant-1", {
      fullName: "New Electrician",
      designation: "ELECTRICIAN",
      availabilityStatus: "ON_LEAVE",
      canReceiveWorkOrders: false
    });

    expect(created).toMatchObject({
      availabilityStatus: "ON_LEAVE",
      canReceiveWorkOrders: false,
      active: true
    });

    await expect(
      service.create("tenant-1", {
        fullName: "Blank Status",
        designation: "HELPER",
        availabilityStatus: " "
      })
    ).rejects.toThrow(BadRequestException);
    expect(prisma.employee.create).toHaveBeenCalledTimes(1);
  });
});
