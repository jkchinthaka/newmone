import { BadRequestException } from "@nestjs/common";
import { AssetStatus, VehicleStatus, WorkOrderStatus } from "@prisma/client";

import {
  assertDomainReleaseAllowed,
  assertDomainTestAllowsCompletion,
  assertJobDomainSubjects,
  assertMonotonicMeterReading,
  displayOperationalStatus,
  formatAssetIdentity,
  formatLocationIdentity,
  formatVehicleIdentity,
  isFailedDomainTest
} from "../src/common/utils/work-order-domain.util";
import { WorkOrderDomainService } from "../src/modules/work-orders/work-order-domain.service";

describe("D3/D4/D5 work-order domain utils", () => {
  it("requires Asset for MACHINERY", () => {
    expect(() =>
      assertJobDomainSubjects({ jobDomain: "MACHINERY", assetId: null, vehicleId: null })
    ).toThrow(BadRequestException);
    expect(
      assertJobDomainSubjects({
        jobDomain: "MACHINERY",
        assetId: "clxyz0123456789abcdefgh"
      })
    ).toBe("MACHINERY");
  });

  it("requires Functional Location for SERVICE", () => {
    expect(() =>
      assertJobDomainSubjects({
        jobDomain: "SERVICE",
        assetId: "clxyz0123456789abcdefgh"
      })
    ).toThrow(/Functional Location/);
    expect(
      assertJobDomainSubjects({
        jobDomain: "SERVICE",
        functionalLocationId: "clxyz0123456789abcdefgh"
      })
    ).toBe("SERVICE");
  });

  it("requires Vehicle for VEHICLE and does not accept asset alone", () => {
    expect(() =>
      assertJobDomainSubjects({
        jobDomain: "VEHICLE",
        assetId: "clxyz0123456789abcdefgh"
      })
    ).toThrow(/Vehicle/);
    expect(
      assertJobDomainSubjects({
        jobDomain: "VEHICLE",
        vehicleId: "clxyz0123456789abcdefgh"
      })
    ).toBe("VEHICLE");
  });

  it("blocks lower meter/odometer readings", () => {
    expect(() =>
      assertMonotonicMeterReading({ previous: 1000, next: 999, label: "Odometer" })
    ).toThrow(/lower than last accepted/);
    expect(() => assertMonotonicMeterReading({ previous: 1000, next: 1000 })).not.toThrow();
  });

  it("blocks failed functional/road tests on completion and release", () => {
    expect(() =>
      assertDomainTestAllowsCompletion({
        jobDomain: "MACHINERY",
        functionalTestResult: "FAIL"
      })
    ).toThrow(/Failed or partial functional test/);

    expect(() =>
      assertDomainTestAllowsCompletion({
        jobDomain: "VEHICLE",
        roadTestResult: "FAIL"
      })
    ).toThrow(/Failed or partial vehicle test/);

    expect(isFailedDomainTest("PARTIAL")).toBe(true);
    expect(isFailedDomainTest("PASS")).toBe(false);

    expect(() =>
      assertDomainReleaseAllowed({
        functionalTestResult: "FAIL",
        criticalOpenWorkOrderCount: 0
      })
    ).toThrow(/Cannot return target to service/);

    expect(() =>
      assertDomainReleaseAllowed({
        functionalTestResult: "PASS",
        criticalOpenWorkOrderCount: 1
      })
    ).toThrow(/critical open work order/);

    expect(() =>
      assertDomainReleaseAllowed({
        functionalTestResult: "PASS",
        temporaryRepair: true,
        operatingRestriction: "Max 40 km/h",
        criticalOpenWorkOrderCount: 0
      })
    ).toThrow(/operating restriction/);
  });

  it("formats human-readable identities and blank status", () => {
    expect(formatAssetIdentity({ assetTag: "MCH-023", name: "Packing Machine 03" })).toBe(
      "MCH-023 — Packing Machine 03"
    );
    expect(formatLocationIdentity({ code: "LOC-CR02", name: "Cold Room 02" })).toBe(
      "LOC-CR02 — Cold Room 02"
    );
    expect(
      formatVehicleIdentity({
        registrationNo: "WP CA-1234",
        assetTag: "VEH-017",
        make: "Isuzu",
        vehicleModel: "NPR"
      })
    ).toBe("WP CA-1234 — VEH-017 — Isuzu NPR");
    expect(displayOperationalStatus("")).toBe("Status not set");
    expect(displayOperationalStatus("UNDER_MAINTENANCE")).toBe("UNDER MAINTENANCE");
  });
});

describe("D3/D4/D5 WorkOrderDomainService", () => {
  const actor = { sub: "admin-1", tenantId: "tenant-a", role: "ADMIN" as const };

  it("syncs asset and vehicle to UNDER_MAINTENANCE on start", async () => {
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          jobDomain: "MACHINERY",
          assetId: "asset-1",
          vehicleId: "veh-1",
          woNumber: "WO-1"
        })
      },
      asset: {
        findFirst: jest.fn().mockResolvedValue({ id: "asset-1", status: AssetStatus.ACTIVE }),
        update: jest.fn().mockResolvedValue({})
      },
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({ id: "veh-1", status: VehicleStatus.AVAILABLE }),
        update: jest.fn().mockResolvedValue({})
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };

    const service = new WorkOrderDomainService(prisma as any);
    await service.syncTargetUnderMaintenance("wo-1", actor);

    expect(prisma.asset.update).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: { status: AssetStatus.UNDER_MAINTENANCE }
    });
    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: "veh-1" },
      data: { status: VehicleStatus.UNDER_MAINTENANCE }
    });
  });

  it("does not invent AVAILABLE for blank vehicle status on start — sets UNDER_MAINTENANCE", async () => {
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          jobDomain: "VEHICLE",
          assetId: null,
          vehicleId: "veh-1",
          woNumber: "WO-1"
        })
      },
      asset: { findFirst: jest.fn(), update: jest.fn() },
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({ id: "veh-1", status: "" }),
        update: jest.fn().mockResolvedValue({})
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };

    const service = new WorkOrderDomainService(prisma as any);
    await service.syncTargetUnderMaintenance("wo-1", actor);
    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: "veh-1" },
      data: { status: VehicleStatus.UNDER_MAINTENANCE }
    });
  });

  it("blocks odometer decrease on completion reading", async () => {
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          jobDomain: "VEHICLE",
          assetId: null,
          vehicleId: "veh-1",
          woNumber: "WO-1"
        })
      },
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({ id: "veh-1", currentMileage: 126500 }),
        update: jest.fn()
      },
      vehicleMeterLog: { create: jest.fn() },
      asset: { findFirst: jest.fn(), update: jest.fn() },
      assetMeter: { findFirst: jest.fn() },
      assetMeterReading: { create: jest.fn() }
    };

    const service = new WorkOrderDomainService(prisma as any);
    await expect(
      service.applyCompletionMeterReading({ workOrderId: "wo-1", reading: 126400, actor })
    ).rejects.toThrow(/lower than last accepted/);
    expect(prisma.vehicle.update).not.toHaveBeenCalled();
  });

  it("blocks return-to-service before supervisor verification", async () => {
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          status: WorkOrderStatus.TECHNICIAN_COMPLETED,
          jobDomain: "VEHICLE",
          vehicleId: "veh-1",
          assetId: null,
          woNumber: "WO-1",
          temporaryRepair: false,
          vehicle: { id: "veh-1", status: VehicleStatus.UNDER_MAINTENANCE, complianceStatus: "COMPLIANT" },
          asset: null
        }),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findFirstOrThrow: jest.fn()
      },
      auditLog: { create: jest.fn() },
      vehicle: { update: jest.fn() },
      asset: { update: jest.fn() }
    };

    const service = new WorkOrderDomainService(prisma as any);
    await expect(service.returnToService("wo-1", {}, actor)).rejects.toThrow(
      /Supervisor verification is required/
    );
  });

  it("blocks return-to-service when another critical open WO exists", async () => {
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          status: WorkOrderStatus.VERIFIED,
          jobDomain: "VEHICLE",
          vehicleId: "veh-1",
          assetId: null,
          woNumber: "WO-1",
          temporaryRepair: false,
          functionalTestResult: "PASS",
          roadTestResult: "PASS",
          vehicle: {
            id: "veh-1",
            status: VehicleStatus.UNDER_MAINTENANCE,
            complianceStatus: "COMPLIANT"
          },
          asset: null
        }),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(2),
        findFirstOrThrow: jest.fn()
      },
      auditLog: { create: jest.fn() },
      vehicle: { update: jest.fn() },
      asset: { update: jest.fn() }
    };

    const service = new WorkOrderDomainService(prisma as any);
    await expect(service.returnToService("wo-1", {}, actor)).rejects.toThrow(
      /critical open work order/
    );
    expect(prisma.vehicle.update).not.toHaveBeenCalled();
  });

  it("keeps vehicle OUT_OF_SERVICE on temporary repair with restriction", async () => {
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          status: WorkOrderStatus.VERIFIED,
          jobDomain: "VEHICLE",
          vehicleId: "veh-1",
          assetId: null,
          woNumber: "WO-1",
          temporaryRepair: true,
          operatingRestriction: "Max 40 km/h",
          functionalTestResult: "PASS",
          roadTestResult: "PASS",
          downtimeEndedAt: null,
          vehicle: {
            id: "veh-1",
            status: VehicleStatus.UNDER_MAINTENANCE,
            complianceStatus: "COMPLIANT"
          },
          asset: null
        }),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: "wo-1" })
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      vehicle: { update: jest.fn().mockResolvedValue({}) },
      asset: { update: jest.fn() }
    };

    const service = new WorkOrderDomainService(prisma as any);
    await service.returnToService("wo-1", { note: "Restricted release" }, actor);
    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: "veh-1" },
      data: { status: VehicleStatus.OUT_OF_SERVICE }
    });
    expect(prisma.vehicle.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: VehicleStatus.AVAILABLE } })
    );
  });
});
