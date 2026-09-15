/**
 * Phase 10 — Fleet Lifecycle unit tests.
 * All tests use mocked PrismaService to avoid real DB calls.
 * Gate write path stays in vehicles.service; this tests the lifecycle service.
 *
 * Baseline SHA: 465c73d3616480eb796ebc382b2840cc84331b77
 * Historical tip (reference only): 96fbe49
 */

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { TyreCondition } from "@prisma/client";

import {
  authorizeGateOverride,
  costPerKm,
  evaluateGateOut,
  fuelEfficiency,
  hasActiveTyreConflict,
  validateAccidentRepairClaimChain
} from "../src/modules/fleet-lifecycle/fleet-policies";
import { FleetLifecycleService } from "../src/modules/fleet-lifecycle/fleet-lifecycle.service";
import { PERMISSION_CATALOG } from "../src/database/permission-catalog";

// ── helpers ──────────────────────────────────────────────────────────────────

function buildPrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    vehicle: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn()
    },
    asset: {
      findFirst: jest.fn(),
      create: jest.fn()
    },
    assetMeter: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    vehicleTyre: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn()
    },
    vehicleBattery: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    vehicleAssignment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    driver: {
      findFirst: jest.fn()
    },
    accidentReport: {
      findFirst: jest.fn()
    },
    workOrder: {
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0)
    },
    insuranceClaim: {
      update: jest.fn()
    },
    ...overrides
  };
}

const ACTOR = { sub: "user-1", tenantId: "tenant-1", role: "MANAGER" };

function makeService(prisma: ReturnType<typeof buildPrismaMock>, approvalsService?: unknown) {
  return new FleetLifecycleService(prisma as any, approvalsService as any);
}

// ── 1. evaluateGateOut policy ─────────────────────────────────────────────────

describe("evaluateGateOut — policy", () => {
  const base = {
    vehicleActive: true,
    driverActive: true,
    driverLicenceValid: true,
    insuranceValid: true,
    revenueLicenceValid: true,
    criticalServiceOverdue: false,
    criticalInspectionDefect: false,
    blockFlag: false
  };

  test("1. allows when all checks pass", () => {
    const result = evaluateGateOut(base);
    expect(result.allowed).toBe(true);
    expect(result.blockedReasons).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  test("2. blocks when vehicle inactive", () => {
    const result = evaluateGateOut({ ...base, vehicleActive: false });
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("VEHICLE_INACTIVE");
  });

  test("3. blocks when insurance invalid", () => {
    const result = evaluateGateOut({ ...base, insuranceValid: false });
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("INSURANCE_INVALID");
  });

  test("4. blocks when driver licence invalid", () => {
    const result = evaluateGateOut({ ...base, driverLicenceValid: false });
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("DRIVER_LICENCE_INVALID");
  });

  test("5. blocks when critical service overdue", () => {
    const result = evaluateGateOut({ ...base, criticalServiceOverdue: true });
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("CRITICAL_SERVICE_OVERDUE");
  });

  test("6. blocks when gate blockFlag set", () => {
    const result = evaluateGateOut({ ...base, blockFlag: true });
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("BLOCK_FLAG");
  });

  test("7. warnings do NOT block gate-out", () => {
    const result = evaluateGateOut({ ...base, pmDueSoon: true, docExpiringSoon: true });
    expect(result.allowed).toBe(true);
    expect(result.warnings).toContain("PM_DUE_SOON");
    expect(result.warnings).toContain("DOCUMENT_EXPIRING_SOON");
  });

  test("8. canOverride is true when blocked", () => {
    const result = evaluateGateOut({ ...base, blockFlag: true });
    expect(result.canOverride).toBe(true);
  });
});

// ── 2. authorizeGateOverride policy ──────────────────────────────────────────

describe("authorizeGateOverride — policy", () => {
  test("9. allows override with permission and reason", () => {
    const result = authorizeGateOverride({ hasPermission: true, reason: "Emergency" });
    expect(result.allowed).toBe(true);
    expect(result.code).toBe("OVERRIDE_APPROVED");
  });

  test("10. denies without permission", () => {
    const result = authorizeGateOverride({ hasPermission: false, reason: "Emergency" });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("OVERRIDE_PERMISSION_DENIED");
  });

  test("11. denies when reason missing", () => {
    const result = authorizeGateOverride({ hasPermission: true, reason: "  " });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("OVERRIDE_REASON_REQUIRED");
  });

  test("12. override approval required — blocks when not approved", () => {
    const result = authorizeGateOverride({
      hasPermission: true,
      reason: "Emergency",
      approvalRequired: true,
      approved: false
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("OVERRIDE_APPROVAL_REQUIRED");
  });

  test("13. override approval required — passes when approved", () => {
    const result = authorizeGateOverride({
      hasPermission: true,
      reason: "Emergency",
      approvalRequired: true,
      approved: true
    });
    expect(result.allowed).toBe(true);
  });
});

// ── 3. fuelEfficiency policy ──────────────────────────────────────────────────

describe("fuelEfficiency — policy", () => {
  test("14. computes correctly", () => {
    const r = fuelEfficiency({ litres: 10, distanceKm: 100, amount: 200 });
    expect(r.kmPerLitre).toBeCloseTo(10);
    expect(r.costPerKm).toBeCloseTo(2);
    expect(r.abnormal).toBe(false);
  });

  test("15. returns nulls when distanceKm is 0", () => {
    const r = fuelEfficiency({ litres: 10, distanceKm: 0, amount: 200 });
    expect(r.kmPerLitre).toBeNull();
    expect(r.costPerKm).toBeNull();
  });

  test("16. marks abnormal when kmPerLitre < 3", () => {
    const r = fuelEfficiency({ litres: 100, distanceKm: 100, amount: 200 });
    expect(r.abnormal).toBe(true);
  });
});

// ── 4. costPerKm policy ───────────────────────────────────────────────────────

describe("costPerKm — policy", () => {
  test("17. computes correctly", () => {
    expect(costPerKm({ maintenanceCost: 500, distanceKm: 1000 })).toBeCloseTo(0.5);
  });

  test("18. returns null when distanceKm <= 0", () => {
    expect(costPerKm({ maintenanceCost: 500, distanceKm: 0 })).toBeNull();
    expect(costPerKm({ maintenanceCost: 500, distanceKm: -1 })).toBeNull();
  });
});

// ── 5. validateAccidentRepairClaimChain policy ────────────────────────────────

describe("validateAccidentRepairClaimChain — policy", () => {
  test("19. valid when both accident and WO present", () => {
    const r = validateAccidentRepairClaimChain({ accidentId: "a1", repairWorkOrderId: "wo1" });
    expect(r.valid).toBe(true);
    expect(r.missing).toHaveLength(0);
  });

  test("20. invalid when WO missing", () => {
    const r = validateAccidentRepairClaimChain({ accidentId: "a1" });
    expect(r.valid).toBe(false);
    expect(r.missing).toContain("REPAIR_WO");
  });
});

// ── 6. hasActiveTyreConflict ──────────────────────────────────────────────────

describe("hasActiveTyreConflict — policy", () => {
  test("21. detects conflict on same position", () => {
    const tyres = [{ wheelPosition: "FL", isActive: true }];
    expect(hasActiveTyreConflict(tyres, "FL")).toBe(true);
  });

  test("22. no conflict on different position", () => {
    const tyres = [{ wheelPosition: "FL", isActive: true }];
    expect(hasActiveTyreConflict(tyres, "FR")).toBe(false);
  });

  test("23. no conflict when tyre inactive", () => {
    const tyres = [{ wheelPosition: "FL", isActive: false }];
    expect(hasActiveTyreConflict(tyres, "FL")).toBe(false);
  });
});

// ── 7. Tyre install ───────────────────────────────────────────────────────────

describe("FleetLifecycleService.installTyre", () => {
  test("24. creates tyre when position is free", async () => {
    const prisma = buildPrismaMock();
    prisma.vehicle.findFirst.mockResolvedValue({ id: "v1", tenantId: "tenant-1" });
    prisma.vehicleTyre.findMany.mockResolvedValue([]);
    prisma.vehicleTyre.create.mockResolvedValue({ id: "tyre-1" });
    const svc = makeService(prisma);
    const result = await svc.installTyre(ACTOR, {
      vehicleId: "v1",
      wheelPosition: "FL",
      brand: "Michelin"
    });
    expect(prisma.vehicleTyre.create).toHaveBeenCalled();
    expect(result).toMatchObject({ id: "tyre-1" });
  });

  test("25. blocks install on occupied position", async () => {
    const prisma = buildPrismaMock();
    prisma.vehicle.findFirst.mockResolvedValue({ id: "v1", tenantId: "tenant-1" });
    prisma.vehicleTyre.findMany.mockResolvedValue([{ wheelPosition: "FL", isActive: true }]);
    const svc = makeService(prisma);
    await expect(
      svc.installTyre(ACTOR, { vehicleId: "v1", wheelPosition: "FL" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  test("26. vehicle not found throws NotFoundException", async () => {
    const prisma = buildPrismaMock();
    prisma.vehicle.findFirst.mockResolvedValue(null);
    const svc = makeService(prisma);
    await expect(
      svc.installTyre(ACTOR, { vehicleId: "v1", wheelPosition: "FL" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── 8. Tyre move ──────────────────────────────────────────────────────────────

describe("FleetLifecycleService.moveTyre", () => {
  test("27. move deactivates old and creates new row", async () => {
    const prisma = buildPrismaMock();
    prisma.vehicleTyre.findFirst.mockResolvedValue({
      id: "tyre-1",
      vehicleId: "v1",
      tenantId: "tenant-1",
      wheelPosition: "FL",
      isActive: true,
      serialNumber: "S1",
      brand: "Michelin",
      size: "205/55R16",
      tyreType: null,
      retreadCount: 0,
      condition: TyreCondition.GOOD,
      costSnapshot: null,
      warrantyExpiresAt: null,
      notes: null
    });
    prisma.vehicleTyre.findMany.mockResolvedValue([
      { id: "tyre-1", wheelPosition: "FL", isActive: true }
    ]);
    prisma.vehicleTyre.update.mockResolvedValue({ id: "tyre-1", isActive: false });
    prisma.vehicleTyre.create.mockResolvedValue({ id: "tyre-2" });

    const svc = makeService(prisma);
    const result = await svc.moveTyre(ACTOR, "tyre-1", { newWheelPosition: "RL" });

    expect(prisma.vehicleTyre.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tyre-1" }, data: expect.objectContaining({ isActive: false }) })
    );
    expect(result).toMatchObject({ id: "tyre-2" });
  });
});

// ── 9. Battery install ────────────────────────────────────────────────────────

describe("FleetLifecycleService.installBattery", () => {
  test("28. deactivates previous and creates new battery", async () => {
    const prisma = buildPrismaMock();
    prisma.vehicle.findFirst.mockResolvedValue({ id: "v1", tenantId: "tenant-1" });
    prisma.vehicleBattery.findFirst.mockResolvedValue({ id: "bat-old", isActive: true });
    prisma.vehicleBattery.update.mockResolvedValue({ id: "bat-old", isActive: false });
    prisma.vehicleBattery.create.mockResolvedValue({ id: "bat-new" });
    const svc = makeService(prisma);

    await svc.installBattery(ACTOR, { vehicleId: "v1", brand: "Exide" });

    expect(prisma.vehicleBattery.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "bat-old" }, data: expect.objectContaining({ isActive: false }) })
    );
    expect(prisma.vehicleBattery.create).toHaveBeenCalled();
  });

  test("29. creates battery when none active", async () => {
    const prisma = buildPrismaMock();
    prisma.vehicle.findFirst.mockResolvedValue({ id: "v1", tenantId: "tenant-1" });
    prisma.vehicleBattery.findFirst.mockResolvedValue(null);
    prisma.vehicleBattery.create.mockResolvedValue({ id: "bat-1" });
    const svc = makeService(prisma);

    const result = await svc.installBattery(ACTOR, { vehicleId: "v1" });
    expect(prisma.vehicleBattery.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: "bat-1" });
  });
});

// ── 10. Gate eligibility ──────────────────────────────────────────────────────

describe("FleetLifecycleService.evaluateGateEligibility", () => {
  const now = new Date();
  const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 1000);

  const baseVehicle = {
    id: "v1",
    tenantId: "tenant-1",
    status: "AVAILABLE",
    insuranceExpiry: future,
    roadTaxExpiry: future,
    nextServiceDate: future,
    gateBlocked: false,
    driver: { id: "d1", isAvailable: true, licenseExpiry: future }
  };

  test("30. allows when all checks pass", async () => {
    const prisma = buildPrismaMock();
    prisma.vehicle.findFirst.mockResolvedValue(baseVehicle);
    const svc = makeService(prisma);
    const result = await svc.evaluateGateEligibility(ACTOR, "v1");
    expect(result.allowed).toBe(true);
    expect(result.blockedReasons).toHaveLength(0);
  });

  test("31. blocks when insurance expired", async () => {
    const prisma = buildPrismaMock();
    prisma.vehicle.findFirst.mockResolvedValue({ ...baseVehicle, insuranceExpiry: past });
    const svc = makeService(prisma);
    const result = await svc.evaluateGateEligibility(ACTOR, "v1");
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("INSURANCE_INVALID");
  });

  test("32. blocks when critical service overdue", async () => {
    const prisma = buildPrismaMock();
    prisma.vehicle.findFirst.mockResolvedValue({ ...baseVehicle, nextServiceDate: past });
    const svc = makeService(prisma);
    const result = await svc.evaluateGateEligibility(ACTOR, "v1");
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("CRITICAL_SERVICE_OVERDUE");
  });

  test("33. warnings (PM due soon) do not block", async () => {
    const in15days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const prisma = buildPrismaMock();
    prisma.vehicle.findFirst.mockResolvedValue({
      ...baseVehicle,
      nextServiceDate: in15days
    });
    const svc = makeService(prisma);
    const result = await svc.evaluateGateEligibility(ACTOR, "v1");
    expect(result.allowed).toBe(true);
    expect(result.warnings).toContain("PM_DUE_SOON");
  });

  test("34. blocks when vehicle gateBlocked flag set", async () => {
    const prisma = buildPrismaMock();
    prisma.vehicle.findFirst.mockResolvedValue({ ...baseVehicle, gateBlocked: true });
    const svc = makeService(prisma);
    const result = await svc.evaluateGateEligibility(ACTOR, "v1");
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("BLOCK_FLAG");
  });

  test("35. vehicle not found throws NotFoundException", async () => {
    const prisma = buildPrismaMock();
    prisma.vehicle.findFirst.mockResolvedValue(null);
    const svc = makeService(prisma);
    await expect(svc.evaluateGateEligibility(ACTOR, "v1")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── 11. Driver assignment ─────────────────────────────────────────────────────

describe("FleetLifecycleService.assignDriver", () => {
  test("36. closes current assignment and creates new one", async () => {
    const prisma = buildPrismaMock();
    prisma.vehicle.findFirst.mockResolvedValue({ id: "v1", tenantId: "tenant-1" });
    prisma.driver.findFirst.mockResolvedValue({ id: "d1", tenantId: "tenant-1" });
    prisma.vehicleAssignment.updateMany.mockResolvedValue({ count: 1 });
    prisma.vehicleAssignment.create.mockResolvedValue({ id: "assign-1" });
    prisma.vehicle.update.mockResolvedValue({});
    const svc = makeService(prisma);

    const result = await svc.assignDriver(ACTOR, "v1", "d1", { openingMileage: 50000 });
    expect(prisma.vehicleAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isCurrent: false }) })
    );
    expect(result).toMatchObject({ id: "assign-1" });
  });
});

// ── 12. Accident → WO chain ───────────────────────────────────────────────────

describe("FleetLifecycleService.linkAccidentRepairClaim", () => {
  test("37. creates WO when none provided", async () => {
    const prisma = buildPrismaMock();
    prisma.accidentReport.findFirst.mockResolvedValue({
      id: "acc-1",
      vehicleId: "v1",
      tenantId: "tenant-1"
    });
    prisma.workOrder.create.mockResolvedValue({ id: "wo-1" });
    const svc = makeService(prisma);

    const result = await svc.linkAccidentRepairClaim(ACTOR, { accidentId: "acc-1" });
    expect(prisma.workOrder.create).toHaveBeenCalled();
    expect(result.valid).toBe(true);
    expect(result.repairWorkOrderId).toBe("wo-1");
  });

  test("38. links existing WO to accident", async () => {
    const prisma = buildPrismaMock();
    prisma.accidentReport.findFirst.mockResolvedValue({
      id: "acc-1",
      vehicleId: "v1",
      tenantId: "tenant-1"
    });
    prisma.workOrder.update.mockResolvedValue({ id: "wo-existing" });
    const svc = makeService(prisma);

    const result = await svc.linkAccidentRepairClaim(ACTOR, {
      accidentId: "acc-1",
      repairWorkOrderId: "wo-existing"
    });
    expect(prisma.workOrder.create).not.toHaveBeenCalled();
    expect(result.repairWorkOrderId).toBe("wo-existing");
  });
});

// ── 13. Mileage meter ensure ──────────────────────────────────────────────────

describe("FleetLifecycleService.ensureMileageMeter", () => {
  test("39. skips when vehicle has no assetId", async () => {
    const prisma = buildPrismaMock();
    prisma.vehicle.findFirst.mockResolvedValue({
      id: "v1",
      tenantId: "tenant-1",
      assetId: null,
      currentMileage: 0
    });
    const svc = makeService(prisma);
    const result = await svc.ensureMileageMeter(ACTOR, "v1");
    expect(result).toMatchObject({ skipped: true });
  });

  test("40. creates meter when none exists", async () => {
    const prisma = buildPrismaMock();
    prisma.vehicle.findFirst.mockResolvedValue({
      id: "v1",
      tenantId: "tenant-1",
      assetId: "asset-1",
      currentMileage: 55000
    });
    prisma.assetMeter.findFirst.mockResolvedValue(null);
    prisma.assetMeter.create.mockResolvedValue({ id: "meter-1" });
    const svc = makeService(prisma);
    const result = await svc.ensureMileageMeter(ACTOR, "v1");
    expect(result.created).toBe(true);
    expect(result.meterId).toBe("meter-1");
  });
});

// ── 14. Tenant isolation ──────────────────────────────────────────────────────

describe("Tenant isolation", () => {
  test("41. installTyre rejects vehicle from wrong tenant", async () => {
    const prisma = buildPrismaMock();
    // findFirst returns null when tenantId doesn't match (DB-level filter)
    prisma.vehicle.findFirst.mockResolvedValue(null);
    const svc = makeService(prisma);
    await expect(
      svc.installTyre({ sub: "u1", tenantId: "tenant-A" }, { vehicleId: "v-other-tenant" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── 15. RBAC permission catalog ───────────────────────────────────────────────

describe("RBAC — permission catalog", () => {
  const phase10Keys = [
    "fleet.view",
    "fleet.vehicle.manage",
    "fleet.service.manage",
    "fleet.inspection.perform",
    "fleet.tyre.manage",
    "fleet.battery.manage",
    "fleet.fuel.record",
    "fleet.driver.manage",
    "fleet.assignment.manage",
    "fleet.document.manage",
    "fleet.accident.manage",
    "fleet.claim.manage",
    "fleet.fine.manage",
    "gate.check",
    "gate.record",
    "gate.override"
  ];

  test("42. all Phase 10 permission keys are in the catalog", () => {
    for (const key of phase10Keys) {
      expect(PERMISSION_CATALOG).toContain(key);
    }
  });
});
