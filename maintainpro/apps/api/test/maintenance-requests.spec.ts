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
  });
});

describe("MaintenanceRequestsService", () => {
  const prisma: any = {
    maintenanceRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    maintenanceRequestHistory: { create: jest.fn(), findMany: jest.fn() },
    requestProblemCategory: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn()
    },
    asset: { findFirst: jest.fn() },
    site: { findFirst: jest.fn() },
    functionalLocation: { findFirst: jest.fn() },
    department: { findFirst: jest.fn() },
    assetDomain: { findFirst: jest.fn() },
    workOrder: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    evidenceAttachment: { updateMany: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    user: { findMany: jest.fn() }
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
    prisma.asset.findFirst.mockReset();
    prisma.site.findFirst.mockReset();
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
      description: "Abnormal noise from motor"
    } as never);

    expect(prisma.maintenanceRequest.create).toHaveBeenCalled();
    const data = prisma.maintenanceRequest.create.mock.calls[0][0].data;
    expect(data.assetId).toBe("asset-1");
    expect(data.contextSnapshot.assetTag).toBe("VF-01");
    expect(data.contextSnapshot.locationPath).toBe("Site / Line 1");
    expect(result.requestNumber).toBe("MR-2026-00001");
    expect(result.statusLabel).toBe("New");
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
      functionalLocationId: "fl-1",
      siteId: "site-1",
      description: "Leak",
      priority: Priority.HIGH,
      isEmergency: false,
      problemCategoryLabel: "Leak",
      requestNumber: "MR-2026-00020",
      reportedById: requester.sub
    };

    // startReview: requireRequest + findOne
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

    // approve
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
    prisma.workOrder.update.mockResolvedValue(wo);

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
    prisma.maintenanceRequest.update.mockResolvedValue({
      ...base,
      status: MaintenanceRequestStatus.CONVERTED_TO_WO,
      workOrderId: "wo-1"
    });

    const first = await service.convertToWorkOrder(tenantA, "mr-2", actor, {});
    expect(first.alreadyConverted).toBe(false);
    expect(workOrders.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: WorkOrderType.CORRECTIVE, assetId: "asset-1" }),
      expect.anything()
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

  it("blocks conversion when not approved", async () => {
    prisma.maintenanceRequest.findFirst.mockResolvedValue({
      id: "mr-3",
      tenantId: tenantA,
      status: MaintenanceRequestStatus.UNDER_REVIEW,
      workOrderId: null
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
