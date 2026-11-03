import { BadRequestException } from "@nestjs/common";

import {
  colomboDayStart,
  colomboDaysSpanned,
  WorkforcePlanningService
} from "../src/modules/workforce/workforce-planning.service";

type Row = { estimatedHours: number | null; plannedStartAt: Date | null; plannedEndAt: Date | null };

function build(rows: Row[] | ((where: Record<string, unknown>) => Row[]), capacity = 8) {
  const findMany = jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
    typeof rows === "function" ? rows(where) : rows
  );
  const prisma = {
    employeeLeaveRequest: { findFirst: jest.fn().mockResolvedValue(null) },
    employee: { findUnique: jest.fn().mockResolvedValue({ dailyCapacityHours: capacity, active: true }) },
    workOrderAssignee: { findMany }
  };
  return { service: new WorkforcePlanningService(prisma as never), findMany };
}

describe("Colombo calendar days", () => {
  it("00:30 local on 23 Oct is still 23 Oct, not 22 Oct (UTC)", () => {
    const instant = new Date("2026-10-22T19:00:00.000Z"); // 23 Oct 00:30 +05:30
    expect(colomboDayStart(instant).toISOString()).toBe("2026-10-22T18:30:00.000Z");
  });

  it("counts the days a planned window touches", () => {
    expect(colomboDaysSpanned(new Date("2026-10-23T03:00:00Z"), new Date("2026-10-23T10:00:00Z"))).toBe(1);
    expect(colomboDaysSpanned(new Date("2026-10-23T03:00:00Z"), new Date("2026-10-25T10:00:00Z"))).toBe(3);
  });
});

describe("allocated hours for one day", () => {
  it("only counts open work, the assignment day for undated jobs, and spreads multi-day windows", async () => {
    const { service, findMany } = build([
      { estimatedHours: 4, plannedStartAt: null, plannedEndAt: null },
      { estimatedHours: 6, plannedStartAt: new Date("2026-10-23T03:00:00Z"), plannedEndAt: new Date("2026-10-25T10:00:00Z") }
    ]);
    await expect(service.getAllocatedHoursForDay({ employeeId: "e1", tenantId: "t1", day: new Date("2026-10-23T05:00:00Z") })).resolves.toBe(6);

    const where = findMany.mock.calls[0][0].where as Record<string, any>;
    expect(where.workOrder.status.notIn).toEqual(
      expect.arrayContaining(["TECHNICIAN_COMPLETED", "VERIFIED", "CLOSED", "COMPLETED", "CANCELLED"])
    );
    // Undated assignments are tied to the day they were assigned, not to every day.
    expect(where.OR).toContainEqual({
      plannedStartAt: null,
      assignedAt: { gte: new Date("2026-10-22T18:30:00.000Z"), lte: new Date("2026-10-23T18:29:59.999Z") }
    });
  });
});

describe("assignment is not limited by daily capacity", () => {
  it("allows a job that takes the day over the employee's daily hours", async () => {
    const { service, findMany } = build([{ estimatedHours: 20, plannedStartAt: null, plannedEndAt: null }]);
    await expect(
      service.assertAssignmentAvailability({
        tenantId: "t1",
        employeeId: "e1",
        plannedStartAt: new Date("2026-10-23T03:00:00Z"),
        plannedEndAt: new Date("2026-10-23T09:00:00Z"),
        estimatedHours: 4
      })
    ).resolves.toBeUndefined();
    // No allocated-hours lookup is needed any more.
    expect(findMany).not.toHaveBeenCalled();
  });

  it("still refuses an inactive employee", async () => {
    const { service } = build([]);
    (service as unknown as { prisma: { employee: { findUnique: jest.Mock } } }).prisma.employee.findUnique.mockResolvedValue({ active: false });
    await expect(service.assertAssignmentAvailability({ tenantId: "t1", employeeId: "e1" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("assignment preview no longer reports a capacity warning", async () => {
    const { service } = build([{ estimatedHours: 20, plannedStartAt: null, plannedEndAt: null }]);
    const preview = await service.previewAssignment({ tenantId: "t1", employeeId: "e1", estimatedHours: 4 });
    expect(preview).not.toHaveProperty("exceedsDailyCapacity");
    expect(preview).not.toHaveProperty("dailyCapacityHours");
    expect(preview).toMatchObject({ todayAllocatedHours: 20, incomingHours: 4, inactive: false });
  });
});
