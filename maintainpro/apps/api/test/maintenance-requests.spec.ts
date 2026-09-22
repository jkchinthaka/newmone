import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  MaintenanceRequestStatus,
  Priority,
  Prisma,
  RequestRejectionReasonType,
  WorkOrderType
} from "@prisma/client";

import { assertValidTransition, humanRequestStatus } from "../src/modules/maintenance-requests/request-lifecycle";
import { MaintenanceRequestsService } from "../src/modules/maintenance-requests/maintenance-requests.service";

jest.mock("../src/common/utils/audit-trail.util", () => ({
  writeAuditTrail: jest.fn().mockResolvedValue(undefined)
}));

function uniqueError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0"
  });
}

const tenantA = "tenant-a";
const actor = {
  sub: "user-1",
  role: "MANAGER",
  tenantId: tenantA,
  permissions: [
    "maintenance_requests.create",
    "maintenance_requests.view_all",
    "maintenance_requests.triage",
    "maintenance_requests.approve",
    "maintenance_requests.reject",
    "maintenance_requests.convert",
    "maintenance_requests.cancel_any"
  ]
};
const requester = {
  sub: "user-requester",
  role: "VIEWER",
  tenantId: tenantA,
  permissions: [
    "maintenance_requests.create",
    "maintenance_requests.view_own",
    "maintenance_requests.cancel_own"
  ]
};

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "mr-1",
    tenantId: tenantA,
    requestNumber: "MR-2026-00001",
    status: MaintenanceRequestStatus.NEW,
    priority: Priority.MEDIUM,
    description: "Abnormal noise from motor",
    affectsOperation: false,
    isEmergency: false,
    reportedAt: new Date("2026-09-15T09:12:00Z"),
    createdAt: new Date("2026-09-15T09:12:00Z"),
    publicUpdateNote: null,
    workOrderId: null,
    reportedById: requester.sub,
    assetId: "asset-1",
    siteId: "site-1",
    functionalLocationId: "fl-1",
    triageNotes: null,
    businessImpact: null,
    contextSnapshot: { assetTag: "VF-01", locationPath: "Site / Line 1" },
    rejectionReasonType: null,
    rejectionReason: null,
    cancellationReason: null,
    problemCategoryLabel: null,
    history: [],
    asset: { id: "asset-1", assetTag: "VF-01", name: "Vacuum Filler" },
    site: { id: "site-1", code: "S1", name: "Plant" },
    functionalLocation: { id: "fl-1", code: "L1", name: "Line 1" },
    domain: null,
    problemCategory: null,
    reportedBy: {
      id: requester.sub,
      firstName: "Req",
      lastName: "User",
      email: "r@example.com"
    },
    workOrder: null,
    evidenceAttachments: [],
    duplicateOf: null,
    ...overrides
  };
}

describe("request lifecycle transitions", () => {
  it("allows canonical happy path", () => {
    expect(() =>
      assertValidTransition(MaintenanceRequestStatus.NEW, MaintenanceRequestStatus.UNDER_REVIEW)
    ).not.toThrow();
    expect(() =>
      assertValidTransition(MaintenanceRequestStatus.UNDER_REVIEW, MaintenanceRequestStatus.APPROVED)
    ).not.toThrow();
    expect(() =>
      assertValidTransition(
        MaintenanceRequestStatus.APPROVED,
        MaintenanceRequestStatus.CONVERTED_TO_WO
      )
    ).not.toThrow();
  });

  it("blocks illegal transitions", () => {
    expect(() =>
      assertValidTransition(MaintenanceRequestStatus.REJECTED, MaintenanceRequestStatus.APPROVED)
    ).toThrow(BadRequestException);
    expect(() =>
      assertValidTransition(MaintenanceRequestStatus.CONVERTED_TO_WO, MaintenanceRequestStatus.NEW)
    ).toThrow(BadRequestException);
    expect(() =>
      assertValidTransition(
        MaintenanceRequestStatus.CONVERTED_TO_WO,
        MaintenanceRequestStatus.CANCELLED
      )
    ).toThrow(BadRequestException);
  });

  it("humanizes status labels", () => {
    expect(humanRequestStatus(MaintenanceRequestStatus.UNDER_REVIEW)).toBe("Under Review");
    expect(humanRequestStatus(MaintenanceRequestStatus.APPROVED)).toBe("Accepted");
    expect(humanRequestStatus(MaintenanceRequestStatus.NEEDS_INFORMATION)).toBe(
      "Needs Information"
    );
  });
});

describe("MaintenanceRequestsService", () => {
  const prisma: any = {
    maintenanceRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    maintenanceRequestHistory: { create: jest.fn(), findMany: jest.fn() },
    requestProblemCategory: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn()
    },
    asset: { findFirst: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    site: { findFirst: jest.fn() },
    functionalLocation: { findFirst: jest.fn() },
    department: { findFirst: jest.fn() },
    assetDomain: { findFirst: jest.fn() },
    workOrder: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    evidenceAttachment: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    user: { findMany: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma))
  };

  const assetRegistry = {
    validateSiteAndLocation: jest.fn().mockResolvedValue(undefined),
    resolveLocationPath: jest.fn().mockResolvedValue({ path: "Site / Line 1" })
  };
  const workOrders = { create: jest.fn() };
  const notifications = { createNotification: jest.fn().mockResolvedValue(undefined) };

  let service: MaintenanceRequestsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.maintenanceRequest.findFirst.mockReset();
    prisma.maintenanceRequest.findMany.mockReset();
    prisma.maintenanceRequest.create.mockReset();
    prisma.maintenanceRequest.update.mockReset();
    prisma.maintenanceRequest.updateMany.mockReset();
    prisma.asset.findFirst.mockReset();
    prisma.vehicle.findFirst.mockReset();
    prisma.site.findFirst.mockReset();
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma)
    );
    assetRegistry.validateSiteAndLocation.mockResolvedValue(undefined);
    assetRegistry.resolveLocationPath.mockResolvedValue({ path: "Site / Line 1" });
    service = new MaintenanceRequestsService(
      prisma as never,
      assetRegistry as never,
      workOrders as never,
      notifications as never
    );
  });

  function stubAsset() {
    prisma.asset.findFirst.mockResolvedValue({
      id: "asset-1",
      assetTag: "VF-01",
      name: "Vacuum Filler",
      siteId: "site-1",
      functionalLocationId: "fl-1",
      departmentId: null,
      domainId: null,
      tenantId: tenantA
    });
    prisma.site.findFirst.mockResolvedValue({ id: "site-1", code: "S1", name: "Plant" });
  }

  it("rejects create with neither asset nor functional location", async () => {
    await expect(
      service.create(tenantA, requester, { description: "Roof leak near bay 2" } as never)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates not-sure request with site and approximate location", async () => {
    prisma.site.findFirst.mockResolvedValue({ id: "site-1", code: "S1", name: "Plant" });
    prisma.maintenanceRequest.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        detailRow({
          assetId: null,
          asset: null,
          functionalLocationId: null,
          functionalLocation: null,
          targetUnresolved: true,
          approximateLocation: "Near packing bay",
          jobDomain: null
        })
      );
    prisma.maintenanceRequest.create.mockResolvedValue({
      id: "mr-1",
      requestNumber: "MR-2026-00001",
      status: MaintenanceRequestStatus.NEW
    });
    prisma.maintenanceRequestHistory.create.mockResolvedValue({});

    const result = await service.create(tenantA, requester, {
      targetUnresolved: true,
      siteId: "site-1",
      approximateLocation: "Near packing bay",
      description: "Something is leaking but I am not sure what",
      reportedUrgency: "URGENT",
      safetyImpact: "NOT_SURE",
      productionImpact: "REDUCED"
    } as never);

    const data = prisma.maintenanceRequest.create.mock.calls[0][0].data;
    expect(data.targetUnresolved).toBe(true);
    expect(data.jobDomain).toBeNull();
    expect(data.priority).toBe(Priority.MEDIUM);
    expect(data.reportedUrgency).toBe("URGENT");
    expect(result.statusLabel).toBe("New");
  });

  it("creates asset-only request and snapshots context", async () => {
    stubAsset();
    prisma.maintenanceRequest.findFirst
      .mockResolvedValueOnce(null) // next number
      .mockResolvedValueOnce(detailRow()); // findOne
    prisma.maintenanceRequest.create.mockResolvedValue({
      id: "mr-1",
      requestNumber: "MR-2026-00001",
      status: MaintenanceRequestStatus.NEW
    });
    prisma.maintenanceRequestHistory.create.mockResolvedValue({});

    const result = await service.create(tenantA, requester, {
      assetId: "asset-1",
      description: "Abnormal noise from motor",
      reportedUrgency: "NORMAL",
      safetyImpact: "NO",
      productionImpact: "NONE"
    } as never);

    expect(prisma.maintenanceRequest.create).toHaveBeenCalled();
    const data = prisma.maintenanceRequest.create.mock.calls[0][0].data;
    expect(data.assetId).toBe("asset-1");
    const snapshot = JSON.parse(data.contextSnapshot);
    expect(snapshot.assetTag).toBe("VF-01");
    expect(snapshot.locationPath).toBe("Site / Line 1");
    expect(data.priority).toBe(Priority.MEDIUM);
    expect(result.requestNumber).toBe("MR-2026-00001");
    expect(result.statusLabel).toBe("New");
  });

  it("creates vehicle request with VEHICLE job domain", async () => {
    prisma.vehicle.findFirst.mockResolvedValue({
      id: "veh-1",
      assetId: "asset-v1",
      registrationNo: "WP CA-1234",
      assetTag: "VEH-017",
      make: "Isuzu",
      vehicleModel: "NPR",
      departmentId: null,
      tenantId: tenantA
    });
    prisma.asset.findFirst.mockResolvedValue({
      id: "asset-v1",
      assetTag: "VEH-017",
      name: "Isuzu NPR",
      siteId: "site-1",
      functionalLocationId: null,
      departmentId: null,
      domainId: null,
      tenantId: tenantA,
      serialNumber: null
    });
    prisma.site.findFirst.mockResolvedValue({ id: "site-1", code: "S1", name: "Plant" });
    prisma.maintenanceRequest.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        detailRow({
          vehicleId: "veh-1",
          vehicle: {
            id: "veh-1",
            registrationNo: "WP CA-1234",
            assetTag: "VEH-017",
            make: "Isuzu",
            vehicleModel: "NPR"
          },
          jobDomain: "VEHICLE"
        })
      );
    prisma.maintenanceRequest.create.mockResolvedValue({
      id: "mr-v",
      requestNumber: "MR-2026-00040",
      status: MaintenanceRequestStatus.NEW
    });
    prisma.maintenanceRequestHistory.create.mockResolvedValue({});

    await service.create(tenantA, requester, {
      vehicleId: "veh-1",
      description: "Brake warning light on"
    } as never);

    const data = prisma.maintenanceRequest.create.mock.calls[0][0].data;
    expect(data.vehicleId).toBe("veh-1");
    expect(data.jobDomain).toBe("VEHICLE");
  });

  it("creates functional-location-only request", async () => {
    prisma.maintenanceRequest.findFirst
      .mockResolvedValueOnce(null) // next number
      .mockResolvedValueOnce(
        detailRow({
          id: "mr-fl",
          requestNumber: "MR-2026-00002",
          assetId: null,
          asset: null,
          functionalLocationId: "fl-roof",
          functionalLocation: { id: "fl-roof", code: "ROOF", name: "Roof" },
          description: "Roof leak above packing"
        })
      );
    prisma.maintenanceRequest.create.mockResolvedValue({
      id: "mr-fl",
      requestNumber: "MR-2026-00002",
      status: MaintenanceRequestStatus.NEW
    });
    prisma.maintenanceRequestHistory.create.mockResolvedValue({});

    const result = await service.create(tenantA, requester, {
      functionalLocationId: "fl-roof",
      siteId: "site-1",
      description: "Roof leak above packing"
    } as never);

    expect(result.id).toBe("mr-fl");
    expect(prisma.maintenanceRequest.create.mock.calls[0][0].data.assetId).toBeNull();
  });

  it("blocks cross-tenant asset", async () => {
    prisma.maintenanceRequest.findFirst.mockResolvedValue(null);
    prisma.asset.findFirst.mockResolvedValue(null);
    await expect(
      service.create(tenantA, requester, {
        assetId: "foreign-asset",
        description: "Should fail cross tenant"
      } as never)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns existing request for idempotency key without create", async () => {
    prisma.maintenanceRequest.findFirst
      .mockResolvedValueOnce(detailRow({ id: "mr-existing", requestNumber: "MR-2026-00009" }))
      .mockResolvedValueOnce(detailRow({ id: "mr-existing", requestNumber: "MR-2026-00009" }));

    const result = await service.create(tenantA, requester, {
      assetId: "asset-1",
      description: "Same issue again",
      idempotencyKey: "offline-key-1"
    } as never);

    expect(result.id).toBe("mr-existing");
    expect(prisma.maintenanceRequest.create).not.toHaveBeenCalled();
    expect(prisma.asset.findFirst).not.toHaveBeenCalled();
  });

  it("retries request number on P2002 unique race", async () => {
    stubAsset();
    prisma.maintenanceRequest.findFirst
      .mockResolvedValueOnce(null) // next number attempt 1
      .mockResolvedValueOnce({ requestNumber: "MR-2026-00011" }) // next number attempt 2
      .mockResolvedValueOnce(detailRow({ id: "mr-race", requestNumber: "MR-2026-00012" }));
    prisma.maintenanceRequest.create
      .mockRejectedValueOnce(uniqueError())
      .mockResolvedValueOnce({
        id: "mr-race",
        requestNumber: "MR-2026-00012",
        status: MaintenanceRequestStatus.NEW
      });
    prisma.maintenanceRequestHistory.create.mockResolvedValue({});

    // Seed first number lookup via sticky then override — first create uses 00011 from null+1
    // Explicit: attempt1 latest MR-2026-00010 => create 00011 fails; attempt2 latest 00011 => create 00012
    prisma.maintenanceRequest.findFirst.mockReset();
    prisma.maintenanceRequest.findFirst
      .mockResolvedValueOnce({ requestNumber: "MR-2026-00010" })
      .mockResolvedValueOnce({ requestNumber: "MR-2026-00011" })
      .mockResolvedValueOnce(detailRow({ id: "mr-race", requestNumber: "MR-2026-00012" }));
    prisma.maintenanceRequest.create.mockReset();
    prisma.maintenanceRequest.create
      .mockRejectedValueOnce(uniqueError())
      .mockResolvedValueOnce({
        id: "mr-race",
        requestNumber: "MR-2026-00012",
        status: MaintenanceRequestStatus.NEW
      });

    const result = await service.create(tenantA, requester, {
      assetId: "asset-1",
      description: "Concurrent create race"
    } as never);

    expect(prisma.maintenanceRequest.create).toHaveBeenCalledTimes(2);
    expect(result.requestNumber).toBe("MR-2026-00012");
  });

  it("start review then approve then convert is idempotent", async () => {
    const base = {
      id: "mr-2",
      tenantId: tenantA,
      status: MaintenanceRequestStatus.NEW,
      workOrderId: null,
      assetId: "asset-1",
      vehicleId: null,
      functionalLocationId: "fl-1",
      siteId: "site-1",
      description: "Leak",
      priority: Priority.HIGH,
      isEmergency: false,
      problemCategoryLabel: "Leak",
      requestNumber: "MR-2026-00020",
      reportedById: requester.sub,
      targetUnresolved: false,
      jobDomain: "MACHINERY",
      domainId: null,
      reportedAt: new Date(),
      failureNoticedAt: null
    };

    prisma.maintenanceRequest.findFirst
      .mockResolvedValueOnce(base)
      .mockResolvedValueOnce(
        detailRow({
          ...base,
          status: MaintenanceRequestStatus.UNDER_REVIEW
        })
      );
    prisma.maintenanceRequest.update.mockResolvedValue({
      ...base,
      status: MaintenanceRequestStatus.UNDER_REVIEW
    });
    prisma.maintenanceRequestHistory.create.mockResolvedValue({});
    await service.startReview(tenantA, "mr-2", actor);

    prisma.maintenanceRequest.findFirst
      .mockResolvedValueOnce({ ...base, status: MaintenanceRequestStatus.UNDER_REVIEW })
      .mockResolvedValueOnce(
        detailRow({ ...base, status: MaintenanceRequestStatus.APPROVED })
      );
    prisma.maintenanceRequest.update.mockResolvedValue({
      ...base,
      status: MaintenanceRequestStatus.APPROVED
    });
    await service.approve(tenantA, "mr-2", actor);

    const wo = { id: "wo-1", woNumber: "WO-2026-0001", tenantId: tenantA };
    workOrders.create.mockResolvedValue(wo);

    prisma.maintenanceRequest.findFirst
      .mockResolvedValueOnce({ ...base, status: MaintenanceRequestStatus.APPROVED, workOrderId: null })
      .mockResolvedValueOnce(
        detailRow({
          ...base,
          status: MaintenanceRequestStatus.CONVERTED_TO_WO,
          workOrderId: "wo-1",
          workOrder: wo
        })
      );
    prisma.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.maintenanceRequest.update.mockResolvedValue({
      ...base,
      status: MaintenanceRequestStatus.CONVERTED_TO_WO,
      workOrderId: "wo-1"
    });

    const first = await service.convertToWorkOrder(tenantA, "mr-2", actor, {});
    expect(first.alreadyConverted).toBe(false);
    expect(workOrders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: WorkOrderType.CORRECTIVE,
        assetId: "asset-1",
        jobDomain: "MACHINERY"
      }),
      expect.anything(),
      expect.objectContaining({ tx: expect.anything() })
    );

    prisma.maintenanceRequest.findFirst
      .mockResolvedValueOnce({
        ...base,
        status: MaintenanceRequestStatus.CONVERTED_TO_WO,
        workOrderId: "wo-1"
      })
      .mockResolvedValueOnce(
        detailRow({
          ...base,
          status: MaintenanceRequestStatus.CONVERTED_TO_WO,
          workOrderId: "wo-1",
          workOrder: wo
        })
      );
    prisma.workOrder.findFirst.mockResolvedValue(wo);

    const second = await service.convertToWorkOrder(tenantA, "mr-2", actor, {});
    expect(second.alreadyConverted).toBe(true);
    expect(workOrders.create).toHaveBeenCalledTimes(1);
  });

  it("blocks self-review under segregation of duties", async () => {
    const selfActor = { ...actor, sub: requester.sub };
    prisma.maintenanceRequest.findFirst.mockResolvedValue({
      id: "mr-sod",
      tenantId: tenantA,
      status: MaintenanceRequestStatus.NEW,
      reportedById: requester.sub,
      requestNumber: "MR-2026-00090"
    });
    await expect(service.startReview(tenantA, "mr-sod", selfActor)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("blocks self-accept and self-convert", async () => {
    const selfActor = { ...actor, sub: requester.sub };
    prisma.maintenanceRequest.findFirst.mockResolvedValue({
      id: "mr-sod2",
      tenantId: tenantA,
      status: MaintenanceRequestStatus.UNDER_REVIEW,
      reportedById: requester.sub,
      requestNumber: "MR-2026-00091",
      targetUnresolved: false,
      assetId: "asset-1",
      vehicleId: null,
      functionalLocationId: "fl-1"
    });
    await expect(service.approve(tenantA, "mr-sod2", selfActor)).rejects.toBeInstanceOf(
      ForbiddenException
    );

    prisma.maintenanceRequest.findFirst.mockResolvedValue({
      id: "mr-sod3",
      tenantId: tenantA,
      status: MaintenanceRequestStatus.APPROVED,
      reportedById: requester.sub,
      workOrderId: null,
      requestNumber: "MR-2026-00092",
      targetUnresolved: false,
      assetId: "asset-1"
    });
    await expect(
      service.convertToWorkOrder(tenantA, "mr-sod3", selfActor, {})
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("requester response returns NEEDS_INFORMATION to UNDER_REVIEW", async () => {
    prisma.maintenanceRequest.findFirst
      .mockResolvedValueOnce({
        id: "mr-info",
        tenantId: tenantA,
        status: MaintenanceRequestStatus.NEEDS_INFORMATION,
        reportedById: requester.sub,
        triageOwnerId: actor.sub,
        requestNumber: "MR-2026-00050",
        publicUpdateNote: "What noise?"
      })
      .mockResolvedValueOnce(
        detailRow({
          id: "mr-info",
          status: MaintenanceRequestStatus.UNDER_REVIEW,
          publicUpdateNote: "Loud grinding from gearbox"
        })
      );
    prisma.maintenanceRequest.update.mockResolvedValue({
      id: "mr-info",
      status: MaintenanceRequestStatus.UNDER_REVIEW
    });
    prisma.maintenanceRequestHistory.create.mockResolvedValue({});

    const result = await service.respondToInformationRequest(tenantA, "mr-info", requester, {
      response: "Loud grinding from gearbox"
    });
    expect(prisma.maintenanceRequestHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "REQUESTER_RESPONDED" })
      })
    );
    expect(result.status).toBe(MaintenanceRequestStatus.UNDER_REVIEW);
  });

  it("blocks supervisor from submitting requester response", async () => {
    prisma.maintenanceRequest.findFirst.mockResolvedValue({
      id: "mr-info2",
      tenantId: tenantA,
      status: MaintenanceRequestStatus.NEEDS_INFORMATION,
      reportedById: requester.sub
    });
    await expect(
      service.respondToInformationRequest(tenantA, "mr-info2", actor, {
        response: "pretending to be requester"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("blocks conversion when target unresolved", async () => {
    prisma.maintenanceRequest.findFirst.mockResolvedValue({
      id: "mr-unresolved",
      tenantId: tenantA,
      status: MaintenanceRequestStatus.APPROVED,
      workOrderId: null,
      reportedById: requester.sub,
      targetUnresolved: true,
      assetId: null,
      vehicleId: null,
      functionalLocationId: null,
      requestNumber: "MR-2026-00060"
    });
    await expect(
      service.convertToWorkOrder(tenantA, "mr-unresolved", actor, {})
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("concurrent conversions claim once and create a single WO", async () => {
    const approved = {
      id: "mr-race-convert",
      tenantId: tenantA,
      status: MaintenanceRequestStatus.APPROVED,
      workOrderId: null,
      assetId: "asset-1",
      vehicleId: null,
      functionalLocationId: "fl-1",
      siteId: "site-1",
      description: "Race",
      priority: Priority.MEDIUM,
      isEmergency: false,
      problemCategoryLabel: "Leak",
      requestNumber: "MR-2026-00070",
      reportedById: requester.sub,
      targetUnresolved: false,
      jobDomain: "MACHINERY",
      domainId: null,
      reportedAt: new Date(),
      failureNoticedAt: null
    };
    const wo = { id: "wo-race", woNumber: "WO-2026-0099", tenantId: tenantA };

    let claimCount = 0;
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
      const tx = {
        ...prisma,
        maintenanceRequest: {
          ...prisma.maintenanceRequest,
          updateMany: jest.fn(async () => {
            claimCount += 1;
            if (claimCount === 1) return { count: 1 };
            return { count: 0 };
          }),
          findFirst: jest.fn(async () => ({
            ...approved,
            workOrderId: claimCount > 1 ? wo.id : null,
            status:
              claimCount > 1
                ? MaintenanceRequestStatus.CONVERTED_TO_WO
                : MaintenanceRequestStatus.APPROVED
          })),
          update: jest.fn(async () => ({
            ...approved,
            workOrderId: wo.id,
            status: MaintenanceRequestStatus.CONVERTED_TO_WO
          }))
        },
        workOrder: {
          findFirst: jest.fn(async () => wo)
        },
        maintenanceRequestHistory: {
          create: jest.fn().mockResolvedValue({})
        },
        evidenceAttachment: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 })
        }
      };
      return fn(tx as never);
    });

    workOrders.create.mockResolvedValue(wo);
    prisma.maintenanceRequest.findFirst.mockImplementation(async () =>
      detailRow({
        ...approved,
        status: MaintenanceRequestStatus.CONVERTED_TO_WO,
        workOrderId: wo.id,
        workOrder: wo,
        history: []
      })
    );
    // First lookups before txn still need APPROVED without WO — override with sequence then fall back
    prisma.maintenanceRequest.findFirst
      .mockResolvedValueOnce(approved)
      .mockResolvedValueOnce(approved)
      .mockImplementation(async () =>
        detailRow({
          ...approved,
          status: MaintenanceRequestStatus.CONVERTED_TO_WO,
          workOrderId: wo.id,
          workOrder: wo,
          history: []
        })
      );

    const [a, b] = await Promise.all([
      service.convertToWorkOrder(tenantA, "mr-race-convert", actor, {}),
      service.convertToWorkOrder(tenantA, "mr-race-convert", actor, {})
    ]);

    expect(workOrders.create).toHaveBeenCalledTimes(1);
    expect(a.workOrder?.id).toBe(wo.id);
    expect(b.workOrder?.id).toBe(wo.id);
    const winners = [a, b].filter((r) => !r.alreadyConverted);
    const losers = [a, b].filter((r) => r.alreadyConverted);
    expect(winners.length).toBe(1);
    expect(losers.length).toBe(1);
  });

  it("vehicle conversion preserves vehicle identity and VEHICLE domain", async () => {
    const approved = {
      id: "mr-veh",
      tenantId: tenantA,
      status: MaintenanceRequestStatus.APPROVED,
      workOrderId: null,
      assetId: "asset-v1",
      vehicleId: "veh-1",
      functionalLocationId: null,
      siteId: "site-1",
      description: "Brake issue",
      priority: Priority.HIGH,
      isEmergency: false,
      problemCategoryLabel: "Vehicle",
      requestNumber: "MR-2026-00080",
      reportedById: requester.sub,
      targetUnresolved: false,
      jobDomain: "VEHICLE",
      domainId: null,
      reportedAt: new Date(),
      failureNoticedAt: null
    };
    const wo = {
      id: "wo-veh",
      woNumber: "WO-2026-0080",
      tenantId: tenantA,
      vehicleId: "veh-1",
      jobDomain: "VEHICLE",
      status: "OPEN"
    };
    prisma.maintenanceRequest.findFirst
      .mockResolvedValueOnce(approved)
      .mockResolvedValueOnce(
        detailRow({
          ...approved,
          status: MaintenanceRequestStatus.CONVERTED_TO_WO,
          workOrderId: wo.id,
          workOrder: wo
        })
      );
    prisma.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.maintenanceRequest.update.mockResolvedValue({
      ...approved,
      workOrderId: wo.id,
      status: MaintenanceRequestStatus.CONVERTED_TO_WO
    });
    workOrders.create.mockResolvedValue(wo);

    const result = await service.convertToWorkOrder(tenantA, "mr-veh", actor, {});
    expect(result.alreadyConverted).toBe(false);
    expect(workOrders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleId: "veh-1",
        jobDomain: "VEHICLE"
      }),
      expect.anything(),
      expect.objectContaining({ tx: expect.anything() })
    );
  });

  it("blocks conversion when not approved", async () => {
    prisma.maintenanceRequest.findFirst.mockResolvedValue({
      id: "mr-3",
      tenantId: tenantA,
      status: MaintenanceRequestStatus.UNDER_REVIEW,
      workOrderId: null,
      reportedById: requester.sub
    });
    await expect(service.convertToWorkOrder(tenantA, "mr-3", actor, {})).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("reject requires OTHER text", async () => {
    prisma.maintenanceRequest.findFirst.mockResolvedValue({
      id: "mr-4",
      tenantId: tenantA,
      status: MaintenanceRequestStatus.UNDER_REVIEW
    });
    await expect(
      service.reject(tenantA, "mr-4", actor, {
        reasonType: RequestRejectionReasonType.OTHER
      } as never)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks requester from triage", async () => {
    await expect(service.startReview(tenantA, "mr-5", requester)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("duplicate candidates stay advisory", async () => {
    prisma.maintenanceRequest.findFirst.mockResolvedValue({
      id: "mr-6",
      tenantId: tenantA,
      assetId: "asset-1",
      functionalLocationId: "fl-1",
      problemCategoryId: "cat-1",
      reportedById: requester.sub,
      status: MaintenanceRequestStatus.NEW
    });
    prisma.maintenanceRequest.findMany.mockResolvedValue([
      detailRow({
        id: "mr-older",
        requestNumber: "MR-2026-00001",
        status: MaintenanceRequestStatus.UNDER_REVIEW,
        description: "Same asset issue"
      })
    ]);

    const result = await service.duplicateCandidates(tenantA, "mr-6", actor);
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(prisma.maintenanceRequest.update).not.toHaveBeenCalled();
  });
});
