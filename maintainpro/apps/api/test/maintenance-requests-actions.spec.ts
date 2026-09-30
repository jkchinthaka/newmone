import { ConflictException, ForbiddenException } from "@nestjs/common";
import { MaintenanceRequestStatus, Priority } from "@prisma/client";

import { MaintenanceRequestsService } from "../src/modules/maintenance-requests/maintenance-requests.service";
import {
  requestAllowedActions,
  requestStageFilter,
  type RequestCapabilities
} from "../src/modules/maintenance-requests/request-lifecycle";

jest.mock("../src/common/utils/audit-trail.util", () => ({
  writeAuditTrail: jest.fn().mockResolvedValue(undefined)
}));

const tenantA = "tenant-a";

const NO_CAPS: RequestCapabilities = {
  canReport: false,
  canTriage: false,
  canApprove: false,
  canReject: false,
  canConvert: false,
  canCancelOwn: false,
  canCancelAny: false
};
const REQUESTER_CAPS: RequestCapabilities = { ...NO_CAPS, canReport: true, canCancelOwn: true };
const REVIEWER_CAPS: RequestCapabilities = {
  canReport: true,
  canTriage: true,
  canApprove: true,
  canReject: true,
  canConvert: true,
  canCancelOwn: true,
  canCancelAny: true
};

function subject(overrides: Partial<Parameters<typeof requestAllowedActions>[0]> = {}) {
  return {
    status: MaintenanceRequestStatus.NEW,
    isOwner: false,
    targetUnresolved: false,
    hasTarget: true,
    workOrderId: null,
    ...overrides
  };
}

describe("requestAllowedActions", () => {
  it("lets the requester cancel only while the request is New", () => {
    const fresh = requestAllowedActions(subject({ isOwner: true }), REQUESTER_CAPS);
    expect(fresh.cancel).toEqual({ allowed: true });

    for (const status of [
      MaintenanceRequestStatus.UNDER_REVIEW,
      MaintenanceRequestStatus.NEEDS_INFORMATION,
      MaintenanceRequestStatus.APPROVED
    ]) {
      const actions = requestAllowedActions(subject({ isOwner: true, status }), REQUESTER_CAPS);
      expect(actions.cancel.allowed).toBe(false);
      expect(actions.cancel.reason).toMatch(/reviewer/i);
    }
  });

  it("offers nothing actionable to a user without request permissions", () => {
    const actions = requestAllowedActions(subject(), NO_CAPS);
    expect(Object.values(actions).some((action) => action.allowed)).toBe(false);
  });

  it("blocks reviewer actions on their own request with a segregation-of-duties reason", () => {
    const actions = requestAllowedActions(
      subject({ isOwner: true, status: MaintenanceRequestStatus.UNDER_REVIEW }),
      REVIEWER_CAPS
    );
    for (const key of ["approve", "close", "requestInformation", "markDuplicate", "triage"] as const) {
      expect(actions[key].allowed).toBe(false);
      expect(actions[key].reason).toMatch(/segregation of duties/i);
    }
    // cancel_any still lets a reviewer withdraw their own report
    expect(actions.cancel.allowed).toBe(true);
  });

  it("explains why accept and convert are blocked while the target is unresolved", () => {
    const review = requestAllowedActions(
      subject({ status: MaintenanceRequestStatus.UNDER_REVIEW, targetUnresolved: true, hasTarget: false }),
      REVIEWER_CAPS
    );
    expect(review.approve.allowed).toBe(false);
    expect(review.approve.reason).toMatch(/confirm/i);
    expect(review.triage.allowed).toBe(true);
  });

  it("offers convert only for accepted requests without a work order", () => {
    expect(
      requestAllowedActions(subject({ status: MaintenanceRequestStatus.APPROVED }), REVIEWER_CAPS).convert
        .allowed
    ).toBe(true);
    expect(
      requestAllowedActions(
        subject({ status: MaintenanceRequestStatus.APPROVED, workOrderId: "wo-1" }),
        REVIEWER_CAPS
      ).convert.allowed
    ).toBe(false);
    expect(
      requestAllowedActions(subject({ status: MaintenanceRequestStatus.UNDER_REVIEW }), REVIEWER_CAPS)
        .convert.allowed
    ).toBe(false);
  });

  it("requires the endpoint permission for each reviewer action", () => {
    const triageOnly = { ...NO_CAPS, canTriage: true };
    const actions = requestAllowedActions(
      subject({ status: MaintenanceRequestStatus.UNDER_REVIEW }),
      triageOnly
    );
    expect(actions.requestInformation.allowed).toBe(true);
    // approve / close have their own endpoint permissions
    expect(actions.approve.allowed).toBe(false);
    expect(actions.close.allowed).toBe(false);
  });

  it("only offers the requester response to the owner while information is needed", () => {
    const needsInfo = subject({ status: MaintenanceRequestStatus.NEEDS_INFORMATION });
    expect(requestAllowedActions({ ...needsInfo, isOwner: true }, REQUESTER_CAPS).respond.allowed).toBe(
      true
    );
    expect(requestAllowedActions(needsInfo, REVIEWER_CAPS).respond.allowed).toBe(false);
  });

  it("never offers any action on terminal requests", () => {
    for (const status of [
      MaintenanceRequestStatus.CLOSED,
      MaintenanceRequestStatus.CANCELLED,
      MaintenanceRequestStatus.CONVERTED_TO_WO
    ]) {
      const actions = requestAllowedActions(subject({ status, isOwner: true }), REVIEWER_CAPS);
      expect(Object.values(actions).some((action) => action.allowed)).toBe(false);
    }
  });
});

describe("MaintenanceRequestsService permissions, concurrency and counters", () => {
  const prisma: any = {
    maintenanceRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    maintenanceRequestHistory: { create: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn()
  };
  const assetRegistry = { resolveLocationPath: jest.fn().mockResolvedValue(null) };
  let service: MaintenanceRequestsService;

  const reviewer = { sub: "reviewer-1", role: "SUPERVISOR", tenantId: tenantA };
  const requestRow = {
    id: "mr-1",
    tenantId: tenantA,
    requestNumber: "MR-2026-00001",
    status: MaintenanceRequestStatus.NEW,
    priority: Priority.MEDIUM,
    reportedById: "requester-1",
    assetId: "asset-1",
    workOrderId: null,
    targetUnresolved: false,
    version: 3
  };

  function dbRole(keys: string[]) {
    return { role: { permissionLinks: keys.map((key) => ({ permission: { key } })) } };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MaintenanceRequestsService(
      prisma as never,
      assetRegistry as never,
      {} as never,
      { createNotification: jest.fn() } as never
    );
  });

  it("uses the role's DB permissions when the JWT carries none (custom role)", async () => {
    prisma.user.findUnique.mockResolvedValue(dbRole(["maintenance_requests.triage"]));
    prisma.maintenanceRequest.findFirst
      .mockResolvedValueOnce(requestRow)
      .mockResolvedValueOnce({ ...requestRow, status: MaintenanceRequestStatus.UNDER_REVIEW })
      .mockResolvedValueOnce({ ...requestRow, status: MaintenanceRequestStatus.UNDER_REVIEW, history: [] });
    prisma.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });

    await service.startReview(tenantA, "mr-1", { sub: "custom-1", role: "PLANT_LEAD", tenantId: tenantA });

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "custom-1" } })
    );
    expect(prisma.maintenanceRequest.updateMany).toHaveBeenCalled();
  });

  it("accepts a legacy alias permission the endpoint guard also accepts", async () => {
    prisma.user.findUnique.mockResolvedValue(dbRole(["facility_issues.manage"]));
    prisma.maintenanceRequest.findFirst
      .mockResolvedValueOnce(requestRow)
      .mockResolvedValueOnce({ ...requestRow, status: MaintenanceRequestStatus.UNDER_REVIEW })
      .mockResolvedValueOnce({ ...requestRow, status: MaintenanceRequestStatus.UNDER_REVIEW, history: [] });
    prisma.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.startReview(tenantA, "mr-1", reviewer)).resolves.toBeDefined();
  });

  it("honours a revoked triage permission even for a traditionally privileged role", async () => {
    prisma.user.findUnique.mockResolvedValue(dbRole(["maintenance_requests.view_own"]));
    prisma.maintenanceRequest.findFirst.mockResolvedValue(requestRow);

    await expect(
      service.startReview(tenantA, "mr-1", { sub: "mgr-1", role: "MANAGER", tenantId: tenantA })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.maintenanceRequest.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a stale write instead of overwriting a concurrent change", async () => {
    // Requester cancels from a stale view while a reviewer has already moved the request on.
    const requester = {
      sub: "requester-1",
      role: "VIEWER",
      tenantId: tenantA,
      permissions: ["maintenance_requests.cancel_own", "maintenance_requests.create"]
    };
    prisma.maintenanceRequest.findFirst.mockResolvedValue(requestRow);
    prisma.maintenanceRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.cancel(tenantA, "mr-1", requester, { reason: "No longer needed" })
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.maintenanceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "mr-1",
          tenantId: tenantA,
          status: MaintenanceRequestStatus.NEW,
          version: 3
        })
      })
    );
    expect(prisma.maintenanceRequestHistory.create).not.toHaveBeenCalled();
  });

  it("blocks a reviewer from closing a request they reported", async () => {
    const selfReviewer = {
      ...reviewer,
      sub: "requester-1",
      permissions: ["maintenance_requests.triage", "maintenance_requests.reject"]
    };
    prisma.maintenanceRequest.findFirst.mockResolvedValue({
      ...requestRow,
      status: MaintenanceRequestStatus.UNDER_REVIEW
    });

    await expect(
      service.reject(tenantA, "mr-1", selfReviewer, { reasonType: "NOT_MAINTENANCE" } as never)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.maintenanceRequest.updateMany).not.toHaveBeenCalled();
  });

  it("counts each summary stage with the same predicate the list uses for that stage", async () => {
    const manager = {
      ...reviewer,
      permissions: ["maintenance_requests.view_all", "maintenance_requests.triage"]
    };
    prisma.maintenanceRequest.count.mockResolvedValue(0);
    prisma.maintenanceRequest.findMany.mockResolvedValue([]);

    await service.summary(tenantA, manager);
    const summaryWheres = prisma.maintenanceRequest.count.mock.calls.map(
      ([args]: [{ where: unknown }]) => args.where
    );

    const stages = ["open", "awaiting_triage", "urgent", "converted"] as const;
    for (const [index, stage] of stages.entries()) {
      prisma.maintenanceRequest.count.mockClear();
      await service.list(tenantA, manager, { stage } as never);
      const listWhere = prisma.maintenanceRequest.count.mock.calls[0][0].where;
      expect(listWhere).toEqual(summaryWheres[index]);

      const filter = requestStageFilter(stage);
      expect(listWhere.status).toEqual({ in: filter.statuses });
      expect(filter.statuses).not.toContain(MaintenanceRequestStatus.CANCELLED);
      expect(filter.statuses).not.toContain(MaintenanceRequestStatus.CLOSED);
    }
  });

  it("scopes the summary to the caller's own requests on the My Requests view", async () => {
    const manager = { ...reviewer, permissions: ["maintenance_requests.view_all"] };
    prisma.maintenanceRequest.count.mockResolvedValue(2);

    const result = await service.summary(tenantA, manager, { mine: true });

    expect(result.scope).toBe("mine");
    for (const [args] of prisma.maintenanceRequest.count.mock.calls) {
      expect(args.where.reportedById).toBe(reviewer.sub);
    }
  });

  it("returns capabilities so the page does not re-derive role rules", async () => {
    prisma.maintenanceRequest.count.mockResolvedValue(0);
    const requester = {
      sub: "requester-1",
      role: "VIEWER",
      tenantId: tenantA,
      permissions: ["maintenance_requests.create", "maintenance_requests.view_own"]
    };

    const result = await service.summary(tenantA, requester);

    expect(result.scope).toBe("mine");
    expect(result.capabilities).toEqual(
      expect.objectContaining({ canReport: true, canTriage: false, canViewAll: false })
    );
  });
});
