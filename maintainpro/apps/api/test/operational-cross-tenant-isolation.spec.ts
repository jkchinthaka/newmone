import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";

import { requestContext, type AuditRequestContext } from "../src/common/context/request-context";
import { AccidentsService } from "../src/modules/accidents/accidents.service";
import { CleaningService } from "../src/modules/cleaning/cleaning.service";
import { ComplianceService } from "../src/modules/compliance/compliance.service";
import { InsuranceClaimsService } from "../src/modules/insurance-claims/insurance-claims.service";
import { OperationsService } from "../src/modules/operations/operations.service";
import { TrafficFinesService } from "../src/modules/traffic-fines/traffic-fines.service";
import { UtilitiesService } from "../src/modules/utilities/utilities.service";

const TENANT_A = "507f1f77bcf86cd7994390a1";
const TENANT_B = "507f1f77bcf86cd7994390b2";
const VEHICLE_ID = "507f1f77bcf86cd799439011";
const DRIVER_ID = "507f1f77bcf86cd799439022";

const actorA = { sub: "user-a", email: "a@x.io", role: "ADMIN", tenantId: TENANT_A } as const;
const tenantlessActor = { sub: "user-x", email: "x@x.io", role: "ADMIN", tenantId: null } as const;

const ctx = (tenantId: string | null): AuditRequestContext => ({
  actorId: "user-a",
  actorEmail: "a@x.io",
  actorRole: "ADMIN",
  tenantId,
  module: null,
  ipAddress: null,
  userAgent: null,
  requestPath: null
});

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
describe("Utilities cross-tenant isolation", () => {
  const buildPrisma = () => ({
    utilityMeter: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    meterReading: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    utilityBill: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() }
  });

  it("tenant-less caller is denied (403) and never touches the database", () => {
    const prisma = buildPrisma();
    const service = new UtilitiesService(prisma as never);
    expect(() => service.meters(null)).toThrow(ForbiddenException);
    expect(prisma.utilityMeter.findMany).not.toHaveBeenCalled();
  });

  it("cannot fetch another tenant's meter by id", async () => {
    const prisma = buildPrisma();
    prisma.utilityMeter.findFirst.mockResolvedValue(null);
    const service = new UtilitiesService(prisma as never);
    await expect(service.meter("meter-b", TENANT_A)).rejects.toThrow(NotFoundException);
    expect(prisma.utilityMeter.findFirst).toHaveBeenCalledWith({ where: { id: "meter-b", tenantId: TENANT_A } });
  });

  it("cannot attach a bill to a meter owned by another tenant", async () => {
    const prisma = buildPrisma();
    prisma.utilityMeter.findFirst.mockResolvedValue(null); // meter not in caller's tenant
    const service = new UtilitiesService(prisma as never);
    await expect(
      service.createBill(TENANT_A, {
        meterId: "meter-b",
        billingPeriodStart: "2026-01-01",
        billingPeriodEnd: "2026-01-31",
        totalConsumption: 10,
        ratePerUnit: 2
      })
    ).rejects.toThrow(NotFoundException);
    expect(prisma.utilityBill.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Operations (scan lookup)
// ─────────────────────────────────────────────────────────────────────────────
describe("Operations cross-tenant isolation", () => {
  const buildPrisma = () => ({
    asset: { findFirst: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    driver: { findFirst: jest.fn() },
    workOrder: { findFirst: jest.fn() }
  });

  it("tenant-less caller is denied (403)", async () => {
    const prisma = buildPrisma();
    const service = new OperationsService(prisma as never);
    await expect(service.scanLookup("WO-1", { tenantId: null })).rejects.toThrow(ForbiddenException);
  });

  it("scopes lookups to the caller's tenant", async () => {
    const prisma = buildPrisma();
    prisma.asset.findFirst.mockResolvedValue(null);
    prisma.vehicle.findFirst.mockResolvedValue(null);
    prisma.driver.findFirst.mockResolvedValue(null);
    prisma.workOrder.findFirst.mockResolvedValue(null);
    const service = new OperationsService(prisma as never);
    await expect(service.scanLookup("UNKNOWN", { tenantId: TENANT_A })).rejects.toThrow(NotFoundException);
    expect(prisma.asset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Compliance
// ─────────────────────────────────────────────────────────────────────────────
describe("Compliance cross-tenant isolation", () => {
  const buildPrisma = () => ({
    vehicle: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(), count: jest.fn() },
    vehicleDocument: { findMany: jest.fn() }
  });

  it("tenant-less actor is denied (403)", async () => {
    const prisma = buildPrisma();
    const service = new ComplianceService(prisma as never);
    await expect(service.getVehicleCompliance(VEHICLE_ID, tenantlessActor)).rejects.toThrow(ForbiddenException);
  });

  it("cannot evaluate a vehicle owned by another tenant", async () => {
    const prisma = buildPrisma();
    prisma.vehicle.findFirst.mockResolvedValue(null); // not found within TENANT_A scope
    const service = new ComplianceService(prisma as never);
    await expect(service.getVehicleCompliance(VEHICLE_ID, actorA)).rejects.toThrow(NotFoundException);
    expect(prisma.vehicle.findFirst).toHaveBeenCalledWith({ where: { id: VEHICLE_ID, tenantId: TENANT_A } });
  });

  it("fleet summary is scoped to the actor's tenant", async () => {
    const prisma = buildPrisma();
    prisma.vehicle.count.mockResolvedValue(0);
    const service = new ComplianceService(prisma as never);
    await service.fleetSummary(actorA);
    expect(prisma.vehicle.count).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Accidents / Insurance / Traffic fines
// ─────────────────────────────────────────────────────────────────────────────
describe("Accidents cross-tenant isolation", () => {
  const buildPrisma = () => ({
    accidentReport: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    accidentEvidence: { create: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    driver: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
    workOrder: { create: jest.fn(), count: jest.fn() },
    auditLog: { create: jest.fn() }
  });

  it("tenant-less actor is denied (403) when listing", async () => {
    const prisma = buildPrisma();
    const service = new AccidentsService(prisma as never);
    await expect(service.list(tenantlessActor)).rejects.toThrow(ForbiddenException);
  });

  it("cannot fetch an accident owned by another tenant", async () => {
    const prisma = buildPrisma();
    prisma.accidentReport.findFirst.mockResolvedValue(null);
    const service = new AccidentsService(prisma as never);
    await expect(service.findOne("acc-b", actorA)).rejects.toThrow(NotFoundException);
    expect(prisma.accidentReport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "acc-b", tenantId: TENANT_A } })
    );
  });

  it("cannot report an accident against another tenant's vehicle", async () => {
    const prisma = buildPrisma();
    prisma.vehicle.findFirst.mockResolvedValue(null); // vehicle not in TENANT_A
    const service = new AccidentsService(prisma as never);
    await expect(
      service.create(
        { vehicleId: VEHICLE_ID, occurredAt: "2026-01-01T00:00:00Z", location: "Gate", description: "Bump" },
        actorA
      )
    ).rejects.toThrow(NotFoundException);
    expect(prisma.accidentReport.create).not.toHaveBeenCalled();
  });

  it("cannot link a driver from another tenant when reporting an accident", async () => {
    const prisma = buildPrisma();
    prisma.vehicle.findFirst.mockResolvedValue({ id: VEHICLE_ID, tenantId: TENANT_A });
    prisma.driver.findFirst.mockResolvedValue(null); // driver not in TENANT_A
    const service = new AccidentsService(prisma as never);
    await expect(
      service.create(
        { vehicleId: VEHICLE_ID, driverId: DRIVER_ID, occurredAt: "2026-01-01T00:00:00Z", location: "Gate", description: "Bump" },
        actorA
      )
    ).rejects.toThrow(NotFoundException);
    expect(prisma.accidentReport.create).not.toHaveBeenCalled();
  });
});

describe("Insurance claims cross-tenant isolation", () => {
  const buildPrisma = () => ({
    insuranceClaim: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    accidentReport: { findFirst: jest.fn(), findMany: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() }
  });

  it("tenant-less actor is denied (403) when listing", async () => {
    const prisma = buildPrisma();
    const service = new InsuranceClaimsService(prisma as never);
    await expect(service.list(tenantlessActor)).rejects.toThrow(ForbiddenException);
  });

  it("cannot link a claim to an accident owned by another tenant", async () => {
    const prisma = buildPrisma();
    prisma.vehicle.findFirst.mockResolvedValue({ id: VEHICLE_ID, tenantId: TENANT_A });
    prisma.accidentReport.findFirst.mockResolvedValue(null); // accident not in TENANT_A
    prisma.insuranceClaim.count.mockResolvedValue(0);
    const service = new InsuranceClaimsService(prisma as never);
    await expect(
      service.create(
        {
          vehicleId: VEHICLE_ID,
          accidentId: "507f1f77bcf86cd799439033",
          policyNumber: "P1",
          insurerName: "Acme",
          claimAmount: 100
        },
        actorA
      )
    ).rejects.toThrow(NotFoundException);
    expect(prisma.insuranceClaim.create).not.toHaveBeenCalled();
  });
});

describe("Traffic fines cross-tenant isolation", () => {
  const buildPrisma = () => ({
    trafficFine: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    driver: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
    workOrder: { create: jest.fn(), count: jest.fn() },
    auditLog: { create: jest.fn() }
  });
  const vehicleDocuments = { findValidOnDate: jest.fn() };

  it("tenant-less actor is denied (403) when listing", async () => {
    const prisma = buildPrisma();
    const service = new TrafficFinesService(prisma as never, vehicleDocuments as never);
    await expect(service.list(tenantlessActor)).rejects.toThrow(ForbiddenException);
  });

  it("cannot record a fine against another tenant's vehicle", async () => {
    const prisma = buildPrisma();
    prisma.vehicle.findFirst.mockResolvedValue(null);
    const service = new TrafficFinesService(prisma as never, vehicleDocuments as never);
    await expect(
      service.create({ vehicleId: VEHICLE_ID, fineDate: "2026-01-01", offense: "Speed", fineAmount: 50 }, actorA)
    ).rejects.toThrow(NotFoundException);
    expect(prisma.trafficFine.create).not.toHaveBeenCalled();
  });

  it("cannot link a driver from another tenant to a fine", async () => {
    const prisma = buildPrisma();
    prisma.vehicle.findFirst.mockResolvedValue({ id: VEHICLE_ID, tenantId: TENANT_A });
    prisma.driver.findFirst.mockResolvedValue(null);
    const service = new TrafficFinesService(prisma as never, vehicleDocuments as never);
    await expect(
      service.create(
        { vehicleId: VEHICLE_ID, driverId: DRIVER_ID, fineDate: "2026-01-01", offense: "Speed", fineAmount: 50 },
        actorA
      )
    ).rejects.toThrow(NotFoundException);
    expect(prisma.trafficFine.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cleaning
// ─────────────────────────────────────────────────────────────────────────────
describe("Cleaning cross-tenant isolation", () => {
  const buildPrisma = () => ({
    user: { findMany: jest.fn(), findFirst: jest.fn() },
    cleaningLocation: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    cleaningVisit: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), groupBy: jest.fn() },
    facilityIssue: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), groupBy: jest.fn(), count: jest.fn() },
    room: { findFirst: jest.fn() }
  });
  const deps = () => [{} as never, {} as never, {} as never, {} as never] as const;

  const build = (prisma: ReturnType<typeof buildPrisma>) => {
    const [config, qr, notif, wo] = deps();
    return new CleaningService(prisma as never, config, qr, notif, wo);
  };

  it("tenant-less caller is denied (403) when listing assignable cleaners", async () => {
    const prisma = buildPrisma();
    const service = build(prisma);
    await expect(service.listAssignableCleaners(null)).rejects.toThrow(ForbiddenException);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("listLocations scopes to the caller's tenant", async () => {
    const prisma = buildPrisma();
    prisma.cleaningLocation.findMany.mockResolvedValue([]);
    prisma.cleaningVisit.groupBy.mockResolvedValue([]);
    prisma.facilityIssue.groupBy.mockResolvedValue([]);
    const service = build(prisma);
    await service.listLocations(TENANT_A);
    expect(prisma.cleaningLocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_A } })
    );
  });

  it("cannot fetch a location owned by another tenant", async () => {
    const prisma = buildPrisma();
    prisma.cleaningLocation.findUnique.mockResolvedValue({ id: "loc-b", tenantId: TENANT_B, qrCode: "q", qrCodeUrl: "u" });
    const service = build(prisma);
    await requestContext.run(ctx(TENANT_A), async () => {
      await expect(service.getLocation("loc-b")).rejects.toThrow(NotFoundException);
    });
  });

  it("cannot assign a cleaner from another tenant to a new location", async () => {
    const prisma = buildPrisma();
    prisma.user.findFirst.mockResolvedValue(null); // cleaner not in TENANT_A
    const service = build(prisma);
    await expect(
      service.createLocation(TENANT_A, { name: "Lobby", assignedCleanerId: "cleaner-b" } as never)
    ).rejects.toThrow(BadRequestException);
    expect(prisma.cleaningLocation.create).not.toHaveBeenCalled();
  });
});
