import {
  authorizeGateOverride,
  evaluateGateOut,
  fuelEfficiency,
  validateAccidentRepairClaimChain
} from "../src/modules/fleet-lifecycle/fleet-policies";
import { FleetLifecycleService } from "../src/modules/fleet-lifecycle/fleet-lifecycle.service";
import { GateMovementStatus, WorkOrderType } from "@prisma/client";

describe("Phase 10 fleet policies", () => {
  it("blocks gate-out when licence/insurance invalid", () => {
    const decision = evaluateGateOut({
      vehicleActive: true,
      driverActive: true,
      driverLicenceValid: false,
      insuranceValid: false,
      revenueLicenceValid: true,
      criticalServiceOverdue: false,
      criticalInspectionDefect: false,
      blockFlag: false
    });
    expect(decision.allowed).toBe(false);
    expect(decision.blockedReasons).toEqual(
      expect.arrayContaining(["DRIVER_LICENCE_INVALID", "INSURANCE_INVALID"])
    );
  });

  it("requires permission + reason for override and audits approval path", () => {
    expect(
      authorizeGateOverride({ hasPermission: false, reason: "urgent" }).allowed
    ).toBe(false);
    expect(
      authorizeGateOverride({ hasPermission: true, reason: "" }).code
    ).toBe("OVERRIDE_REASON_REQUIRED");
    expect(
      authorizeGateOverride({
        hasPermission: true,
        reason: "emergency delivery",
        approvalRequired: true,
        approved: true
      }).code
    ).toBe("OVERRIDE_APPROVED");
  });

  it("computes fuel km/L and cost/km", () => {
    const report = fuelEfficiency({ litres: 40, distanceKm: 400, amount: 20000 });
    expect(report.kmPerLitre).toBe(10);
    expect(report.costPerKm).toBe(50);
    expect(report.abnormal).toBe(false);
  });

  it("validates accident → repair WO chain", () => {
    expect(
      validateAccidentRepairClaimChain({
        accidentId: "a1",
        repairWorkOrderId: "wo1",
        insuranceClaimId: "c1"
      }).valid
    ).toBe(true);
    expect(
      validateAccidentRepairClaimChain({ accidentId: "a1" }).missing
    ).toContain("REPAIR_WO");
  });
});

describe("Phase 10 FleetLifecycleService", () => {
  const actor = { sub: "user-1", tenantId: "tenant-1", role: "ADMIN" };

  it("links vehicle to asset", async () => {
    const prisma = {
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({ id: "v1" }),
        update: jest.fn().mockResolvedValue({ id: "v1", assetId: "a1", assetTag: "AST-1" })
      },
      asset: {
        findFirst: jest.fn().mockResolvedValue({ id: "a1", assetTag: "AST-1" })
      }
    };
    const service = new FleetLifecycleService(prisma as any);
    const row = await service.linkVehicleToAsset(actor, "v1", "a1");
    expect(row.assetId).toBe("a1");
  });

  it("records blocked gate and override", async () => {
    const prisma = {
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({
          id: "v1",
          status: "AVAILABLE",
          insuranceExpiry: new Date("2020-01-01"),
          roadTaxExpiry: new Date("2030-01-01"),
          nextServiceDate: null,
          currentMileage: 10000,
          driver: { id: "d1", isAvailable: true, licenseExpiry: new Date("2030-01-01") },
          documents: []
        })
      },
      driver: { findFirst: jest.fn() },
      vehicleGateMovement: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "g1", ...data }))
      }
    };
    const service = new FleetLifecycleService(prisma as any);
    const blocked = await service.evaluateAndRecordGateOut(actor, { vehicleId: "v1" });
    expect(blocked.status).toBe(GateMovementStatus.BLOCKED);

    const overridden = await service.evaluateAndRecordGateOut(actor, {
      vehicleId: "v1",
      override: true,
      overrideReason: "management approval"
    });
    expect(overridden.status).toBe(GateMovementStatus.OVERRIDE_APPROVED);
  });

  it("creates accident repair WO linkage", async () => {
    const prisma = {
      accidentReport: {
        findFirst: jest.fn().mockResolvedValue({ id: "acc-1", vehicleId: "v1", tenantId: "tenant-1" })
      },
      workOrder: {
        create: jest.fn().mockResolvedValue({ id: "wo-acc", type: WorkOrderType.ACCIDENT_REPAIR })
      },
      insuranceClaim: { update: jest.fn() }
    };
    const service = new FleetLifecycleService(prisma as any);
    const result = await service.linkAccidentRepairClaim(actor, { accidentId: "acc-1" });
    expect(result.valid).toBe(true);
    expect(result.repairWorkOrderId).toBe("wo-acc");
  });
});
