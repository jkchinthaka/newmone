import { NotFoundException } from "@nestjs/common";

import { OperationsService } from "../src/modules/operations/operations.service";

describe("OperationsService", () => {
  let prisma: {
    asset: { findFirst: jest.Mock };
    vehicle: { findFirst: jest.Mock };
    driver: { findFirst: jest.Mock };
    workOrder: { findFirst: jest.Mock };
  };
  let service: OperationsService;

  beforeEach(() => {
    prisma = {
      asset: { findFirst: jest.fn() },
      vehicle: { findFirst: jest.fn() },
      driver: { findFirst: jest.fn() },
      workOrder: { findFirst: jest.fn() }
    };

    service = new OperationsService(prisma as never);
  });

  it("resolves a route-hinted vehicle using tenant-scoped lookup", async () => {
    prisma.vehicle.findFirst.mockResolvedValue({
      id: "veh-1",
      registrationNo: "ABC-1234",
      make: "Isuzu",
      vehicleModel: "Elf",
      status: "IN_SERVICE",
      assetTag: "VH-100",
      driverId: "driver-1"
    });

    const result = await service.scanLookup(
      "https://maintainpro.test/fleet/vehicles/veh-1",
      { tenantId: "tenant-1" }
    );

    expect(prisma.vehicle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1"
        })
      })
    );
    expect(result.target).toMatchObject({
      type: "VEHICLE",
      id: "veh-1",
      route: "/fleet/vehicles/veh-1",
      matchedBy: "route"
    });
  });

  it("throws when no tenant-scoped operational target matches the scan", async () => {
    prisma.asset.findFirst.mockResolvedValue(null);
    prisma.vehicle.findFirst.mockResolvedValue(null);
    prisma.driver.findFirst.mockResolvedValue(null);
    prisma.workOrder.findFirst.mockResolvedValue(null);

    await expect(
      service.scanLookup("WO-404", { tenantId: "tenant-1" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});