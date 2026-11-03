import {
  ApprovalProcessType,
  ApprovalRequestStatus,
  ApprovalStepStatus,
  MaintenanceRequestStatus,
  NotificationPriority,
  Priority
} from "@prisma/client";

import { ApprovalInboxService } from "../src/modules/approvals/approval-inbox.service";
import { APPROVAL_STEP_WAITING, ApprovalsService } from "../src/modules/approvals/approvals.service";
import { MaintenanceRequestsService } from "../src/modules/maintenance-requests/maintenance-requests.service";
import { assertValidTransition } from "../src/modules/maintenance-requests/request-lifecycle";
import { reopenRequestAfterWorkOrderExit } from "../src/modules/maintenance-requests/request-work-order-exit";

describe("converted request exits when its work order is rejected or cancelled", () => {
  function prismaWith(request: unknown) {
    const tx = {
      maintenanceRequest: {
        findFirst: jest.fn().mockResolvedValue(request),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      maintenanceRequestHistory: { create: jest.fn() },
      evidenceAttachment: { updateMany: jest.fn() },
      workOrder: { updateMany: jest.fn() }
    };
    return { ...tx, $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) };
  }

  it("allows CONVERTED_TO_WO → UNDER_REVIEW only", () => {
    expect(() =>
      assertValidTransition(MaintenanceRequestStatus.CONVERTED_TO_WO, MaintenanceRequestStatus.UNDER_REVIEW)
    ).not.toThrow();
    expect(() =>
      assertValidTransition(MaintenanceRequestStatus.CONVERTED_TO_WO, MaintenanceRequestStatus.APPROVED)
    ).toThrow();
  });

  it("returns the request to review, unlinks the work order and tells the reporter why", async () => {
    const prisma = prismaWith({ id: "mr-1", requestNumber: "MR-1", reportedById: "reporter", status: "CONVERTED_TO_WO" });
    const notifications = { createNotification: jest.fn() };

    const result = await reopenRequestAfterWorkOrderExit(prisma, notifications, {
      tenantId: "t1",
      workOrderId: "wo-1",
      woNumber: "WO-9",
      outcome: "REJECTED",
      reason: "Duplicate of WO-8",
      actorId: "mgr"
    });

    expect(result).toEqual({ requestId: "mr-1" });
    expect(prisma.maintenanceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: MaintenanceRequestStatus.CONVERTED_TO_WO, workOrderId: "wo-1" }),
        data: expect.objectContaining({ status: MaintenanceRequestStatus.UNDER_REVIEW, workOrderId: null })
      })
    );
    expect(prisma.maintenanceRequestHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "WORK_ORDER_REJECTED", reason: "Duplicate of WO-8" })
    });
    // The default conversion idempotency key is released so re-convert creates a fresh work order.
    expect(prisma.workOrder.updateMany).toHaveBeenCalledWith({
      where: { id: "wo-1", tenantId: "t1", lastIdempotencyKey: "mr-convert:mr-1" },
      data: { lastIdempotencyKey: null }
    });
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "reporter", message: expect.stringContaining("Duplicate of WO-8") })
    );
  });

  it("does nothing when no converted request is linked", async () => {
    const prisma = prismaWith(null);
    const notifications = { createNotification: jest.fn() };
    await expect(
      reopenRequestAfterWorkOrderExit(prisma, notifications, {
        tenantId: "t1",
        workOrderId: "wo-1",
        outcome: "CANCELLED",
        reason: "No longer needed"
      })
    ).resolves.toBeNull();
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });
});

describe("maintenance request notifications and inbox approval", () => {
  const actor = { sub: "mgr", tenantId: "t1", role: "MANAGER", permissions: ["maintenance_requests.approve", "maintenance_requests.triage"] };

  it("notifies triagers (critical priority for emergencies), not only the reporter", async () => {
    const prisma = { user: { findMany: jest.fn().mockResolvedValue([{ id: "triager-1" }, { id: "triager-2" }]) } };
    const notifications = { createNotification: jest.fn() };
    const service = new MaintenanceRequestsService(prisma as never, {} as never, {} as never, notifications as never);

    await (service as unknown as { notifyNewRequest: Function }).notifyNewRequest(
      "t1",
      { id: "mr-1", requestNumber: "MR-1", priority: Priority.MEDIUM, isEmergency: true },
      "reporter"
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "t1", id: { not: "reporter" } }) })
    );
    const recipients = notifications.createNotification.mock.calls.map(([input]) => input.userId);
    expect(recipients).toEqual(["reporter", "triager-1", "triager-2"]);
    expect(notifications.createNotification.mock.calls[1][0].priority).toBe("CRITICAL");
  });

  it("approving a NEW request from the inbox records NEW → UNDER_REVIEW → APPROVED in one transaction", async () => {
    const row = {
      id: "mr-1",
      tenantId: "t1",
      requestNumber: "MR-1",
      status: MaintenanceRequestStatus.NEW,
      version: 1,
      reportedById: "reporter",
      targetUnresolved: false,
      assetId: "asset-1",
      vehicleId: null,
      functionalLocationId: null,
      domainId: null,
      jobDomain: null,
      reviewedAt: null,
      priority: Priority.HIGH
    };
    const prisma: Record<string, any> = {
      maintenanceRequest: {
        findFirst: jest.fn().mockResolvedValue(row),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      maintenanceRequestHistory: { create: jest.fn() },
      auditLog: { create: jest.fn() }
    };
    prisma.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
    const service = new MaintenanceRequestsService(prisma as never, {} as never, {} as never, { createNotification: jest.fn() } as never);
    jest.spyOn(service, "findOne").mockResolvedValue({ id: "mr-1" } as never);

    await service.approve("t1", "mr-1", actor, { reviewFirst: true });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.maintenanceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: MaintenanceRequestStatus.NEW }),
        data: expect.objectContaining({ status: MaintenanceRequestStatus.APPROVED })
      })
    );
    const actions = prisma.maintenanceRequestHistory.create.mock.calls.map(([args]: [{ data: { action: string } }]) => args.data.action);
    expect(actions).toEqual(["START_REVIEW", "APPROVED"]);
  });

  it("still rejects NEW → APPROVED without the inbox review step", async () => {
    const prisma = {
      maintenanceRequest: {
        findFirst: jest.fn().mockResolvedValue({ id: "mr-1", status: MaintenanceRequestStatus.NEW, reportedById: "reporter" })
      }
    };
    const service = new MaintenanceRequestsService(prisma as never, {} as never, {} as never, {} as never);
    await expect(service.approve("t1", "mr-1", actor)).rejects.toThrow(/Illegal status transition/);
  });
});

describe("approval engine levels", () => {
  it("never assigns the requester as approver; falls back to the next role user, then ADMIN", async () => {
    const prisma = {
      user: {
        findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
          const role = (where.role as { name?: string } | undefined)?.name;
          if (where.id === "requester") return { id: "requester" }; // requester holds the role
          if (role === "MANAGER") return null; // the only manager is the requester
          if (role === "ADMIN") return { id: "admin-1" };
          return null;
        })
      }
    };
    const service = new ApprovalsService(prisma as never, { createNotification: jest.fn() } as never);
    const result = await (service as unknown as { resolveLevels: Function }).resolveLevels(
      { id: "rule-1", tenantId: "t1", slaHours: 4, levels: [{ level: 1, approverRole: "MANAGER", approverUserId: null, backupUserId: null }] },
      "t1",
      "requester"
    );
    expect(result.levels[0].assignedApproverId).toBe("admin-1");
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: "requester" } }) })
    );
  });

  it("creates later levels WAITING and activates + notifies the next level on approval", async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma: Record<string, any> = {
      approvalRequest: {
        create: jest.fn(async ({ data }: { data: { steps: { create: Array<Record<string, unknown>> } } }) => {
          created.push(...data.steps.create);
          return { id: "ar-1", status: ApprovalRequestStatus.PENDING, steps: data.steps.create.map((s, i) => ({ ...s, id: `s${i + 1}` })) };
        }),
        update: jest.fn()
      },
      auditLog: { create: jest.fn() },
      approvalDecision: { create: jest.fn().mockResolvedValue({ id: "d1" }) },
      approvalStep: {
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
          id: where.id,
          level: 2,
          assignedApproverId: "approver-2",
          backupApproverId: null,
          ...data
        })),
        updateMany: jest.fn()
      }
    };
    prisma.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
    const notifications = { createNotification: jest.fn() };
    const service = new ApprovalsService(prisma as never, notifications as never);
    jest.spyOn(service, "findApprovedRequest").mockResolvedValue(null);
    jest.spyOn(service, "findOpenRequest").mockResolvedValue(null);
    jest.spyOn(service, "findMatchingRule").mockResolvedValue({
      id: "rule-1",
      tenantId: "t1",
      version: 1,
      slaHours: 4,
      levels: []
    } as never);
    jest.spyOn(service as unknown as { resolveLevels: () => Promise<unknown> }, "resolveLevels").mockResolvedValue({
      levels: [
        { level: 1, approverRole: null, assignedApproverId: "approver-1", backupApproverId: null },
        { level: 2, approverRole: null, assignedApproverId: "approver-2", backupApproverId: null }
      ]
    });

    await service.ensureApprovalRequired({
      actor: { sub: "requester", tenantId: "t1" },
      processType: ApprovalProcessType.HIGH_COST_WORK_ORDER,
      trigger: "BEFORE_START" as never,
      subjectEntityType: "WorkOrder",
      subjectEntityId: "wo-1",
      context: {} as never
    });
    expect(created.map((s) => s.status)).toEqual([ApprovalStepStatus.PENDING, APPROVAL_STEP_WAITING]);
    expect(created[1].dueAt).toBeUndefined();

    jest.spyOn(service, "getRequest").mockResolvedValue({
      id: "ar-1",
      status: ApprovalRequestStatus.PENDING,
      processType: ApprovalProcessType.HIGH_COST_WORK_ORDER,
      requesterId: "requester",
      updatedAt: new Date(),
      sourceContext: null,
      subjectEntityType: "WorkOrder",
      subjectEntityId: "wo-1",
      ruleSnapshot: { slaHours: 4 },
      steps: [
        { id: "s1", level: 1, status: ApprovalStepStatus.PENDING, assignedApproverId: "approver-1", backupApproverId: null, dueAt: null },
        { id: "s2", level: 2, status: APPROVAL_STEP_WAITING, assignedApproverId: "approver-2", backupApproverId: null, dueAt: null }
      ]
    } as never);
    notifications.createNotification.mockClear();

    await service.decide({
      actor: { sub: "approver-1", tenantId: "t1", role: "MANAGER" },
      requestId: "ar-1",
      decision: "APPROVED" as never
    });

    expect(prisma.approvalStep.update).toHaveBeenCalledWith({
      where: { id: "s2" },
      data: expect.objectContaining({ status: ApprovalStepStatus.PENDING, dueAt: expect.any(Date) })
    });
    expect(prisma.approvalRequest.update).not.toHaveBeenCalled();
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "approver-2", priority: NotificationPriority.WARNING })
    );
  });

  it("level 2 approver cannot decide while level 1 is still active", async () => {
    const service = new ApprovalsService({} as never, { createNotification: jest.fn() } as never);
    jest.spyOn(service, "getRequest").mockResolvedValue({
      id: "ar-1",
      status: ApprovalRequestStatus.PENDING,
      requesterId: "requester",
      steps: [
        { id: "s1", level: 1, status: ApprovalStepStatus.PENDING, assignedApproverId: "approver-1", backupApproverId: null },
        { id: "s2", level: 2, status: APPROVAL_STEP_WAITING, assignedApproverId: "approver-2", backupApproverId: null }
      ]
    } as never);
    await expect(
      service.decide({ actor: { sub: "approver-2", tenantId: "t1", role: "MANAGER" }, requestId: "ar-1", decision: "APPROVED" as never })
    ).rejects.toThrow(/not the assigned approver/);
  });
});

describe("approval inbox list", () => {
  function inboxWith(rows: Array<{ id: string; requestedAt: string }>, truncated = false) {
    const service = new ApprovalInboxService({} as never, {} as never, {} as never);
    const full = rows.map((row) => ({ ...row, kind: "request", tab: "requests", reference: row.id, title: "t", requesterName: "r", priority: null, siteId: null }));
    (service as unknown as { collect: jest.Mock }).collect = jest.fn().mockResolvedValue({ rows: full, truncated });
    return service;
  }
  const actor = { sub: "mgr", tenantId: "t1", role: "ADMIN" };

  it("filters by Asia/Colombo day bounds", async () => {
    const service = inboxWith([
      { id: "before", requestedAt: "2026-10-26T18:00:00.000Z" }, // 23:30 on 26 Oct in Colombo
      { id: "inside", requestedAt: "2026-10-26T19:00:00.000Z" }, // 00:30 on 27 Oct in Colombo
      { id: "late", requestedAt: "2026-10-27T18:20:00.000Z" }, // 23:50 on 27 Oct in Colombo
      { id: "after", requestedAt: "2026-10-27T18:40:00.000Z" } // 00:10 on 28 Oct in Colombo
    ]);
    const result = await service.list(actor, { from: "2026-10-27", to: "2026-10-27" });
    expect(result.items.map((row) => row.id)).toEqual(["inside", "late"]);
  });

  it("pages over every row and reports the true total", async () => {
    const rows = Array.from({ length: 130 }, (_, i) => ({
      id: `r${i}`,
      requestedAt: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString()
    }));
    const service = inboxWith(rows);
    const page3 = await service.list(actor, { page: 3, pageSize: 50 });
    expect(page3.meta).toMatchObject({ total: 130, page: 3, totalPages: 3, truncated: false });
    expect(page3.items).toHaveLength(30);
    expect(page3.items[0].id).toBe("r100");
  });
});
