import { TechniciansService } from "../src/modules/people/technicians.service";

describe("assignable open job count", () => {
  it("counts open assignments for the requested tenant", async () => {
    const prisma = {
      employee: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "emp-1",
            fullName: "Sam",
            email: null,
            phone: null,
            designation: "ELECTRICIAN",
            skills: null,
            workCategories: null,
            dailyCapacityHours: 8,
            departmentId: null,
            branchName: null,
            canLogin: false,
            linkedUserId: null,
            availabilityStatus: "AVAILABLE",
            canReceiveWorkOrders: true,
            department: null,
            linkedUser: null
          }
        ])
      },
      workOrderAssignee: {
        groupBy: jest.fn().mockResolvedValue([{ employeeId: "emp-1", _count: { _all: 4 } }])
      }
    };
    const workforce = { getAllocatedHoursForDay: jest.fn().mockResolvedValue(0) };
    const service = new TechniciansService(prisma as never, workforce as never);

    const rows = await service.listAssignable("tenant-9");

    expect(prisma.workOrderAssignee.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-9",
          workOrder: expect.objectContaining({ tenantId: "tenant-9" })
        })
      })
    );
    expect(rows[0].openJobCount).toBe(4);
    expect(rows[0].availabilityLabel).toBe("Available");
  });
});
