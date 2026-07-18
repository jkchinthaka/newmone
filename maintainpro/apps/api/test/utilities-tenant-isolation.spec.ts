import { ForbiddenException, NotFoundException } from "@nestjs/common";

import { UtilitiesService } from "../src/modules/utilities/utilities.service";

const createPrismaMock = () => ({
  utilityMeter: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  meterReading: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn()
  },
  utilityBill: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn()
  }
});

describe("UtilitiesService tenant isolation", () => {
  const TENANT_A = "tenant-a";

  let prisma: ReturnType<typeof createPrismaMock>;
  let service: UtilitiesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new UtilitiesService(prisma as any);
  });

  it("meters() filters by the caller's tenantId", async () => {
    prisma.utilityMeter.findMany.mockResolvedValue([]);

    await service.meters(TENANT_A);

    expect(prisma.utilityMeter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_A } })
    );
  });

  it("meters() fails closed when there is no tenant context (null tenantId)", async () => {
    prisma.utilityMeter.findMany.mockResolvedValue([]);

    // Fail-closed: without an explicit tenant or request context, deny rather than
    // return every tenant's meters. Utilities is tenant-owned business data.
    // requireTenantId throws synchronously before the Prisma call is issued.
    expect(() => service.meters(null)).toThrow(ForbiddenException);
    expect(prisma.utilityMeter.findMany).not.toHaveBeenCalled();
  });

  it("meter() throws NotFound for a meter belonging to another tenant", async () => {
    prisma.utilityMeter.findFirst.mockResolvedValue(null);

    await expect(service.meter("meter-1", TENANT_A)).rejects.toThrow(NotFoundException);
    expect(prisma.utilityMeter.findFirst).toHaveBeenCalledWith({
      where: { id: "meter-1", tenantId: TENANT_A }
    });
  });

  it("allReadings() only returns readings for meters owned by the tenant", async () => {
    prisma.utilityMeter.findMany.mockResolvedValue([{ id: "meter-a", tenantId: TENANT_A }]);
    prisma.meterReading.findMany.mockResolvedValue([
      { id: "r1", meterId: "meter-a", readingDate: new Date() }
    ]);

    const result = await service.allReadings(TENANT_A);

    expect(prisma.utilityMeter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_A } })
    );
    expect(prisma.meterReading.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { meterId: { in: ["meter-a"] } } })
    );
    expect(result).toHaveLength(1);
  });

  it("allReadings() returns empty array when tenant has no meters", async () => {
    prisma.utilityMeter.findMany.mockResolvedValue([]);

    const result = await service.allReadings(TENANT_A);

    expect(result).toEqual([]);
    expect(prisma.meterReading.findMany).not.toHaveBeenCalled();
  });

  it("bills() filters by tenantId", async () => {
    prisma.utilityBill.findMany.mockResolvedValue([]);

    await service.bills(TENANT_A);

    expect(prisma.utilityBill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_A } })
    );
  });

  it("bill() throws NotFound for a bill belonging to another tenant", async () => {
    prisma.utilityBill.findFirst.mockResolvedValue(null);

    await expect(service.bill("bill-1", TENANT_A)).rejects.toThrow(NotFoundException);
    expect(prisma.utilityBill.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "bill-1", tenantId: TENANT_A } })
    );
  });

  it("createMeter() stamps the caller's tenantId", async () => {
    prisma.utilityMeter.create.mockResolvedValue({ id: "meter-1" });

    await service.createMeter(TENANT_A, {
      meterNumber: "M-1",
      type: "ELECTRICITY",
      location: "Main Building",
      unit: "kWh"
    });

    expect(prisma.utilityMeter.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: TENANT_A })
    });
  });
});
