import { upsertLinkedWorkforceEmployee } from "../src/database/workforce-seed";

describe("workforce seed availability", () => {
  const input = {
    tenantId: "tenant-1",
    employeeNo: "TECH-1",
    fullName: "Seed Technician",
    email: "tech@example.com",
    designation: "Technician",
    skills: ["General maintenance"],
    dailyCapacityHours: 8,
    active: true,
    linkedUserId: "user-1"
  };

  it("creates a new seeded technician as AVAILABLE so assignment can select them", async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: "emp-1", ...data };
        }),
        update: jest.fn()
      }
    };

    await upsertLinkedWorkforceEmployee(prisma as never, input);

    expect(created[0]?.availabilityStatus).toBe("AVAILABLE");
    expect(created[0]?.canReceiveWorkOrders).toBe(true);
    expect(prisma.employee.update).not.toHaveBeenCalled();
  });

  it("does not change availability on an existing seeded employee", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: "emp-existing",
          linkedUserId: "user-1",
          employeeNo: "TECH-1",
          email: "tech@example.com",
          availabilityStatus: ""
        }),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          updates.push(data);
          return { id: "emp-existing" };
        }),
        create: jest.fn()
      }
    };

    await upsertLinkedWorkforceEmployee(prisma as never, input);

    expect(updates[0]).not.toHaveProperty("availabilityStatus");
    expect(prisma.employee.create).not.toHaveBeenCalled();
  });
});
