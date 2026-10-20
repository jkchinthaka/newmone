import { VehicleStatus } from "@prisma/client";

import { MaintenanceRequestsService } from "../src/modules/maintenance-requests/maintenance-requests.service";
import { selectableVehicleLookupWhere } from "../src/modules/maintenance-requests/selectable-vehicle-lookup";

describe("selectable vehicle lookup", () => {
  it("filters registration, tag, make, and model before pagination", () => {
    const where = selectableVehicleLookupWhere("tenant-a", "  WP-458  ");
    expect(where).toEqual({
      tenantId: "tenant-a",
      decommissionedAt: null,
      status: { notIn: [VehicleStatus.DISPOSED, "RETIRED", "DECOMMISSIONED"] },
      OR: [
        { registrationNo: { contains: "WP-458" } },
        { assetTag: { contains: "WP-458" } },
        { make: { contains: "WP-458" } },
        { vehicleModel: { contains: "WP-458" } }
      ]
    });
  });

  it("returns only selection fields and rejects an empty query", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "vehicle-1",
        registrationNo: "WP-458",
        assetTag: "VH-01",
        make: "Isuzu",
        vehicleModel: "NLR",
        assetId: null
      }
    ]);
    const service = new MaintenanceRequestsService(
      { vehicle: { findMany } } as never,
      {} as never,
      {} as never,
      {} as never
    );

    const rows = await service.lookupSelectableVehicles("tenant-a", " isuzu ", 50);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 15,
        select: {
          id: true,
          registrationNo: true,
          assetTag: true,
          make: true,
          vehicleModel: true,
          assetId: true
        }
      })
    );
    expect(rows[0]).not.toHaveProperty("vin");
    await expect(service.lookupSelectableVehicles("tenant-a", "   ")).rejects.toThrow(/registration/i);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
