import { BadRequestException, ForbiddenException } from "@nestjs/common";

import { UtilitiesController } from "../src/modules/utilities/utilities.controller";
import { UtilitiesService } from "../src/modules/utilities/utilities.service";

const TENANT_A = "tenant-a";

function prismaMock() {
  return {
    utilityMeter: { findMany: jest.fn() },
    meterReading: { findMany: jest.fn(), groupBy: jest.fn() }
  };
}

describe("meter reading list limits", () => {
  it("keeps the unfiltered tenant query when no list options are passed", async () => {
    const prisma = prismaMock();
    prisma.utilityMeter.findMany.mockResolvedValue([{ id: "meter-a", tenantId: TENANT_A }]);
    prisma.meterReading.findMany.mockResolvedValue([{ id: "r1", meterId: "meter-a", readingDate: new Date() }]);
    const service = new UtilitiesService(prisma as never);

    await service.allReadings(TENANT_A);

    expect(prisma.utilityMeter.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: TENANT_A } }));
    const query = prisma.meterReading.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ meterId: { in: ["meter-a"] } });
    expect(query.take).toBeUndefined();
    expect(query.where.notes).toBeUndefined();
  });

  it("filters to the caller, the day window, and the take limit", async () => {
    const prisma = prismaMock();
    prisma.utilityMeter.findMany.mockResolvedValue([{ id: "meter-a", tenantId: TENANT_A }]);
    prisma.meterReading.findMany.mockResolvedValue([]);
    const service = new UtilitiesService(prisma as never);
    const before = Date.now();

    await service.allReadings(TENANT_A, { mineUserId: "user-1", days: 7, take: 50 });

    const query = prisma.meterReading.findMany.mock.calls[0][0];
    expect(query.where.notes).toEqual({ contains: "[by:user-1]" });
    expect(query.take).toBe(50);
    const since = query.where.readingDate.gte as Date;
    expect(before - since.getTime()).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(before - since.getTime()).toBeLessThan(8 * 24 * 60 * 60 * 1000);
  });

  it("returns only the latest reading for meters in the caller's tenant", async () => {
    const prisma = prismaMock();
    const newest = new Date("2026-10-22T00:00:00.000Z");
    prisma.utilityMeter.findMany.mockResolvedValue([{ id: "meter-a", tenantId: TENANT_A }]);
    prisma.meterReading.groupBy.mockResolvedValue([{ meterId: "meter-a", _max: { readingDate: newest } }]);
    prisma.meterReading.findMany.mockResolvedValue([{ id: "r-new", meterId: "meter-a", readingDate: newest }]);
    const service = new UtilitiesService(prisma as never);

    const rows = await service.latestReadings(TENANT_A);

    expect(prisma.utilityMeter.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: TENANT_A } }));
    expect(prisma.meterReading.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { meterId: { in: ["meter-a"] } } })
    );
    expect(prisma.meterReading.findMany).toHaveBeenCalledWith({
      where: { OR: [{ meterId: "meter-a", readingDate: newest }] }
    });
    expect(rows).toEqual([expect.objectContaining({ id: "r-new", meter: expect.objectContaining({ tenantId: TENANT_A }) })]);
  });

  it("fails closed without a tenant", async () => {
    const prisma = prismaMock();
    const service = new UtilitiesService(prisma as never);
    await expect(service.latestReadings(null)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.utilityMeter.findMany).not.toHaveBeenCalled();
  });

  it("rejects an oversized take and leaves the service call unused", async () => {
    const service = { allReadings: jest.fn() };
    const controller = new UtilitiesController(service as never);
    await expect(
      controller.allReadings({ user: { sub: "user-1", role: "TECHNICIAN", tenantId: TENANT_A } }, "true", "7", "5000")
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.allReadings).not.toHaveBeenCalled();
  });

  it("passes mine, days, and take only when the query asks for them", async () => {
    const service = { allReadings: jest.fn().mockResolvedValue([]) };
    const controller = new UtilitiesController(service as never);
    const req = { user: { sub: "user-1", role: "TECHNICIAN", tenantId: TENANT_A } };

    await controller.allReadings(req);
    expect(service.allReadings).toHaveBeenLastCalledWith(TENANT_A, undefined);

    await controller.allReadings(req, "true", "7", "50");
    expect(service.allReadings).toHaveBeenLastCalledWith(TENANT_A, { mineUserId: "user-1", days: 7, take: 50 });
  });
});
