import { BadRequestException } from "@nestjs/common";
import {
  AssetStatus,
  EvidenceType,
  GateMovementStatus,
  QrVerificationStatus,
  RoleName,
  VehicleServiceStatus,
  VehicleStatus,
  WorkOrderStatus,
  WorkOrderType
} from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import {
  evaluateEvidenceRequirements,
  EVIDENCE_REQUIRED_WORK_ORDER_TYPES,
  isStorageUploadsEnabled
} from "../src/common/utils/work-order-evidence-governance";
import { EVIDENCE_REQUIRED_TYPES } from "../src/common/utils/work-order-governance";
import { AccidentsService } from "../src/modules/accidents/accidents.service";
import { EvidenceService } from "../src/modules/evidence/evidence.service";
import { EvidenceStorageProviderService } from "../src/modules/evidence/evidence-storage-provider.service";
import { serviceMileageAlertWindow } from "../src/modules/maintenance/maintenance.service";
import { PlanningService } from "../src/modules/planning/planning.service";
import { UtilitiesService } from "../src/modules/utilities/utilities.service";
import { VehiclesService } from "../src/modules/vehicles/vehicles.service";
import { businessDayWindow } from "../src/modules/work-orders/my-jobs.rules";
import { WorkOrderDomainService } from "../src/modules/work-orders/work-order-domain.service";
import { WorkOrderQueuesService } from "../src/modules/work-orders/work-order-queues.service";

const withEnv = (vars: Record<string, string | undefined>, fn: () => void) => {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

describe("evidence governance", () => {
  it("uses one evidence-required list everywhere (union of both former lists)", () => {
    expect(EVIDENCE_REQUIRED_TYPES).toBe(EVIDENCE_REQUIRED_WORK_ORDER_TYPES);
    for (const type of [WorkOrderType.INSTALLATION, WorkOrderType.BREAKDOWN, WorkOrderType.INSPECTION_CORRECTIVE]) {
      expect(EVIDENCE_REQUIRED_TYPES.has(type)).toBe(true);
    }
  });

  it("storage readiness follows the storage provider, not the env flag alone", () => {
    withEnv({ NODE_ENV: "test", STORAGE_MODE: "local", STORAGE_UPLOADS_ENABLED: "true", STORAGE_LOCAL_ROOT: undefined }, () => {
      expect(isStorageUploadsEnabled()).toBe(false);
    });
    withEnv({ NODE_ENV: "test", STORAGE_MODE: "local", STORAGE_UPLOADS_ENABLED: "true", STORAGE_LOCAL_ROOT: "/srv/ev" }, () => {
      expect(isStorageUploadsEnabled()).toBe(true);
    });
    withEnv({ NODE_ENV: "test", STORAGE_MODE: "local", STORAGE_UPLOADS_ENABLED: "false", STORAGE_LOCAL_ROOT: "/srv/ev" }, () => {
      expect(isStorageUploadsEnabled()).toBe(false);
    });
  });

  it("an authorized override lifts the production storage block", () => {
    withEnv({ NODE_ENV: "production" }, () => {
      const blocked = evaluateEvidenceRequirements(WorkOrderType.CORRECTIVE, [], { storageEnabled: false });
      expect(blocked.storageUnavailableBlocking).toBe(true);
      const overridden = evaluateEvidenceRequirements(WorkOrderType.CORRECTIVE, [], {
        storageEnabled: false,
        overrideReason: "Storage outage, photos on file"
      });
      expect(overridden.storageUnavailableBlocking).toBe(false);
    });
  });

  it("close-path evidence needs an accepted before AND after photo, not any two uploads", () => {
    const twoBefore = [
      { evidenceType: EvidenceType.BEFORE_PHOTO, status: "UPLOADED" },
      { evidenceType: EvidenceType.BEFORE_PHOTO, status: "UPLOADED" }
    ];
    const checklist = evaluateEvidenceRequirements(WorkOrderType.CORRECTIVE, twoBefore, { storageEnabled: true });
    expect(checklist.missingAfter).toBe(true);
  });

  it("persists a QR mismatch before rejecting the scan", async () => {
    const provider = new EvidenceStorageProviderService({ get: (_k: string, fallback?: unknown) => fallback } as never);
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          tenantId: "t1",
          assetId: "asset-1",
          vehicleId: null,
          type: "CORRECTIVE",
          qrVerificationStatus: QrVerificationStatus.PENDING
        }),
        update: jest.fn().mockResolvedValue({ id: "wo-1" })
      },
      workOrderAssignee: { findFirst: jest.fn().mockResolvedValue({ id: "a1" }) },
      auditLog: { create: jest.fn() },
      asset: { findFirst: jest.fn().mockResolvedValue(null) },
      vehicle: { findFirst: jest.fn().mockResolvedValue(null) }
    };
    const service = new EvidenceService(prisma as never, provider);
    await expect(
      service.verifyWorkOrderQr("wo-1", { scannedAssetId: "wrong" }, { sub: "tech", tenantId: "t1", role: RoleName.TECHNICIAN, email: "t@x" } as never)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ qrVerificationStatus: QrVerificationStatus.MISMATCH }) })
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

describe("fleet return to service and gate", () => {
  it("return-to-service keeps the asset under maintenance while another (non-critical) job is open", async () => {
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          woNumber: "WO-1",
          status: WorkOrderStatus.VERIFIED,
          assetId: "asset-1",
          vehicleId: null,
          asset: { id: "asset-1", status: AssetStatus.UNDER_MAINTENANCE },
          vehicle: null,
          temporaryRepair: false,
          jobDomain: null,
          downtimeEndedAt: null
        }),
        // Critical-open count (has OR clause) is 0; plain open count is 1.
        count: jest.fn(async ({ where }: { where: Record<string, unknown> }) => (where.OR ? 0 : 1)),
        update: jest.fn(),
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: "wo-1" })
      },
      asset: { update: jest.fn() },
      vehicle: { update: jest.fn() },
      auditLog: { create: jest.fn() }
    };
    const service = new WorkOrderDomainService(prisma as never);
    await service.returnToService("wo-1", {}, { sub: "mgr", tenantId: "t1" } as never);
    expect(prisma.asset.update).not.toHaveBeenCalled();
  });

  function gateHarness(vehicle: Record<string, unknown>) {
    const tx = {
      vehicle: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      vehicleGateMovement: { create: jest.fn().mockResolvedValue({ id: "m1", status: GateMovementStatus.OVERRIDE_APPROVED }) },
      vehicleMeterLog: { create: jest.fn() }
    };
    const prisma = {
      vehicleGateMovement: { create: jest.fn().mockResolvedValue({ id: "blocked-1" }) },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "user-1", tenantId: "tenant-1", role: { name: RoleName.FLEET_MANAGER, permissionLinks: [] } })
      },
      workOrder: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn(async (fn: (client: unknown) => unknown) => fn(tx))
    };
    const service = new VehiclesService(prisma as never, { updateGps: jest.fn() } as never, {
      evaluateForGateOut: jest.fn().mockResolvedValue([])
    } as never);
    jest.spyOn(service, "findOne").mockResolvedValue({
      id: "veh-1",
      status: VehicleStatus.AVAILABLE,
      currentMileage: 1000,
      nextServiceDate: null,
      nextServiceMileage: 2000,
      serviceStatus: VehicleServiceStatus.ON_SCHEDULE,
      driver: null,
      ...vehicle
    } as never);
    return { service, tx, prisma };
  }
  const ctx = {
    actorId: "user-1",
    actorEmail: "a@x",
    actorRole: RoleName.ADMIN as string,
    tenantId: "tenant-1",
    module: null,
    ipAddress: null,
    userAgent: null,
    requestPath: null
  };

  it("an approved override claims the vehicle in its current status (UNDER_MAINTENANCE)", async () => {
    const { service, tx } = gateHarness({ status: VehicleStatus.UNDER_MAINTENANCE });
    await requestContext.run(ctx, () =>
      service.gateOut("veh-1", { meterReading: 1100, allowOverride: true, overrideReason: "Ambulance duty" })
    );
    expect(tx.vehicle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: VehicleStatus.UNDER_MAINTENANCE }) })
    );
  });

  it("an override never claims an IN_USE vehicle", async () => {
    const { service, tx } = gateHarness({ status: VehicleStatus.IN_USE });
    await requestContext.run(ctx, () =>
      service.gateOut("veh-1", { meterReading: 1100, allowOverride: true, overrideReason: "Second exit" })
    ).catch(() => undefined);
    for (const [args] of tx.vehicle.updateMany.mock.calls) {
      expect(args.where.status).toBe(VehicleStatus.AVAILABLE);
    }
  });

  it("evaluates service due with the odometer reading presented at the gate", async () => {
    const { service } = gateHarness({});
    const result = await requestContext.run(ctx, () => service.gateOut("veh-1", { meterReading: 2050 }));
    expect(result.allowed).toBe(false);
    expect(result.blockedReason).toContain("Vehicle service is overdue");
  });

  it("service alerts use the remaining distance against the service interval", () => {
    // 80% of the odometer rule would have flagged this vehicle 8,000 km early.
    expect(serviceMileageAlertWindow({ nextServiceMileage: 50_000, currentMileage: 42_000, serviceIntervalMileage: 10_000 })).toBeNull();
    expect(serviceMileageAlertWindow({ nextServiceMileage: 50_000, currentMileage: 49_200, serviceIntervalMileage: 10_000 })).toEqual({
      remaining: 800,
      threshold: 1000
    });
    expect(serviceMileageAlertWindow({ nextServiceMileage: 50_000, currentMileage: 49_600 })).toEqual({ remaining: 400, threshold: 500 });
    expect(serviceMileageAlertWindow({ nextServiceMileage: 50_000, currentMileage: 49_000 })).toBeNull();
  });
});

describe("utility meters and bills", () => {
  function meterHarness(neighbours: { previous?: Record<string, unknown>; following?: Record<string, unknown> }) {
    const tx = {
      meterReading: {
        findFirst: jest.fn(async ({ where }: { where: { readingDate: unknown } }) => {
          const bound = where.readingDate as Record<string, unknown>;
          if (bound && typeof bound === "object" && "gt" in bound) return neighbours.following ?? null;
          return null;
        }),
        findMany: jest.fn().mockResolvedValue(neighbours.previous ? [neighbours.previous] : []),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "new", ...data })),
        update: jest.fn()
      }
    };
    const prisma = {
      utilityMeter: { findFirst: jest.fn().mockResolvedValue({ id: "m1", unit: "kWh", type: "ELECTRICITY" }) },
      $transaction: jest.fn(async (fn: (client: unknown) => unknown) => fn(tx))
    };
    return { service: new UtilitiesService(prisma as never), tx };
  }

  it("checks a backdated reading against the reading before it and recomputes the next consumption", async () => {
    const { service, tx } = meterHarness({
      previous: { id: "r1", readingDate: new Date("2026-10-01T00:00:00Z"), readingValue: 100, consumption: null, notes: null },
      following: { id: "r3", readingDate: new Date("2026-10-20T00:00:00Z"), readingValue: 300, notes: null }
    });
    const created = await service.addReading("m1", "t1", { readingDate: "2026-10-10T00:00:00Z", readingValue: "180" });
    expect(tx.meterReading.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { meterId: "m1", readingDate: { lt: new Date("2026-10-10T00:00:00Z") } } })
    );
    expect(created.consumption).toBe(80);
    expect(tx.meterReading.update).toHaveBeenCalledWith({ where: { id: "r3" }, data: { consumption: 120 } });
  });

  it("rejects a backdated reading above the next recorded reading", async () => {
    const { service, tx } = meterHarness({
      previous: { id: "r1", readingDate: new Date("2026-10-01T00:00:00Z"), readingValue: 100, consumption: null, notes: null },
      following: { id: "r3", readingDate: new Date("2026-10-20T00:00:00Z"), readingValue: 300, notes: null }
    });
    await expect(
      service.addReading("m1", "t1", { readingDate: "2026-10-10T00:00:00Z", readingValue: "350" })
    ).rejects.toThrow(/higher than the next recorded reading/);
    expect(tx.meterReading.create).not.toHaveBeenCalled();
  });

  it("bills turn overdue from the next Colombo day, and chart months are Colombo months", async () => {
    const prisma = {
      utilityBill: { updateMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      utilityMeter: { findFirst: jest.fn().mockResolvedValue({ id: "m1" }) },
      meterReading: {
        findMany: jest.fn().mockResolvedValue([{ readingDate: new Date("2026-09-30T20:00:00Z"), consumption: 5 }])
      }
    };
    const service = new UtilitiesService(prisma as never);
    await service.overdue("t1");
    const where = prisma.utilityBill.updateMany.mock.calls[0][0].where;
    expect(where.dueDate.lt.getTime()).toBe(businessDayWindow(new Date()).start.getTime());

    const chart = await service.consumptionChart("m1", "t1");
    expect(chart[0].month).toBe("2026-10"); // 01:30 on 1 Oct in Colombo
  });
});

describe("Colombo day rules and pagination", () => {
  it("manager queue overdue uses the start of the Colombo day like My Jobs", () => {
    const service = new WorkOrderQueuesService({} as never, {} as never, {} as never);
    const now = new Date("2026-10-27T20:00:00Z"); // 01:30 on 28 Oct in Colombo
    const where = (service as unknown as { overdueWhere: (now: Date) => { OR: Array<Record<string, any>> } }).overdueWhere(now);
    expect(where.OR[1].dueDate.lt.toISOString()).toBe("2026-10-27T18:30:00.000Z");
  });

  it("inspection due-today uses Colombo day bounds", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-27T20:00:00Z"), doNotFake: ["nextTick", "setImmediate"] });
    try {
      const rows = [
        { id: "a", status: "SCHEDULED", scheduledAt: new Date("2026-10-27T19:00:00Z"), createdAt: new Date(), findingRecords: [] },
        { id: "b", status: "SCHEDULED", scheduledAt: new Date("2026-10-27T18:00:00Z"), createdAt: new Date(), findingRecords: [] }
      ];
      const prisma = { inspection: { findMany: jest.fn().mockResolvedValue(rows) } };
      const service = new PlanningService(prisma as never, {} as never);
      const result = (await service.listInspections({ sub: "u", tenantId: "t1" } as never)) as unknown as {
        items?: Array<{ id: string; dueState: string }>;
        data?: Array<{ id: string; dueState: string }>;
      };
      const items = result.items ?? result.data ?? [];
      expect(items.find((row) => row.id === "a")?.dueState).toBe("DUE_TODAY");
      expect(items.find((row) => row.id === "b")?.dueState).toBe("OVERDUE");
    } finally {
      jest.useRealTimers();
    }
  });

  it("unpaged accident list reports meta.total instead of silently capping", async () => {
    const prisma = {
      accidentReport: {
        count: jest.fn().mockResolvedValue(260),
        findMany: jest.fn().mockResolvedValue([{ id: "acc-1", workOrders: [] }])
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops))
    };
    const service = new AccidentsService(prisma as never);
    const result = await service.list({ sub: "u", tenantId: "t1", role: "ADMIN" } as never);
    expect(result.meta).toMatchObject({ total: 260, page: 1, pageSize: 200, totalPages: 2 });
    expect(prisma.accidentReport.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200, skip: 0 }));
  });
});
