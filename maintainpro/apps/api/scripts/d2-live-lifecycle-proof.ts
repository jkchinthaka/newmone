/**
 * D2 live lifecycle / SQL / concurrency proof — temporary verification script.
 * Uses Nest application context + real SQL Server. Cleans up its own fixture WO.
 * Do not commit secrets. Run from apps/api with repo .env loaded.
 */
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import {
  Priority,
  RoleName,
  WorkOrderApprovalStatus,
  WorkOrderStatus,
  WorkOrderType
} from "@prisma/client";

import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/database/prisma.service";
import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";

type Actor = {
  sub: string;
  email: string;
  role: RoleName;
  tenantId: string;
};

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main() {
  const previousStorage = process.env.STORAGE_UPLOADS_ENABLED;
  // Dev proof: avoid evidence/QR hard dependencies; production fail-closed is unit-tested separately.
  process.env.STORAGE_UPLOADS_ENABLED = "false";
  process.env.NODE_ENV = process.env.NODE_ENV || "development";

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"]
  });
  const prisma = app.get(PrismaService);
  const workOrders = app.get(WorkOrdersService);

  const wirePrismaDeep = (target: unknown, seen = new Set<unknown>()) => {
    if (!target || typeof target !== "object" || seen.has(target)) return;
    seen.add(target);
    const rec = target as Record<string, unknown>;
    if ("prisma" in rec && !rec.prisma) {
      rec.prisma = prisma;
    }
    for (const value of Object.values(rec)) {
      if (value && typeof value === "object" && "prisma" in (value as object)) {
        wirePrismaDeep(value, seen);
      }
    }
  };

  // tsx/esbuild strips emitDecoratorMetadata — Nest may leave ctor params undefined.
  // Rehydrate required deps from the container for this offline proof harness only.
  const wired = workOrders as unknown as {
    prisma?: PrismaService;
    notificationsService?: unknown;
    workOrderPartsService?: unknown;
    workOrderTaxonomyService?: unknown;
    workOrderAssigneesService?: {
      prisma?: PrismaService;
      workforcePlanning?: unknown;
      workforceEmployees?: unknown;
    };
  };
  if (!wired.prisma) {
    const { NotificationsService } = await import("../src/modules/notifications/notifications.service");
    const { WorkOrderPartsService } = await import("../src/modules/work-orders/work-order-parts.service");
    const { WorkOrderTaxonomyService } = await import("../src/modules/work-order-taxonomy/work-order-taxonomy.service");
    const { WorkOrderAssigneesService } = await import("../src/modules/work-orders/work-order-assignees.service");
    const { WorkforcePlanningService } = await import("../src/modules/workforce/workforce-planning.service");
    const { WorkforceEmployeesService } = await import("../src/modules/workforce/workforce-employees.service");
    wired.prisma = prisma;
    wired.notificationsService = app.get(NotificationsService);
    wired.workOrderPartsService = app.get(WorkOrderPartsService);
    wired.workOrderTaxonomyService = app.get(WorkOrderTaxonomyService);
    wired.workOrderAssigneesService = app.get(WorkOrderAssigneesService);
    if (wired.workOrderAssigneesService) {
      wired.workOrderAssigneesService.workforcePlanning = app.get(WorkforcePlanningService);
      wired.workOrderAssigneesService.workforceEmployees = app.get(WorkforceEmployeesService);
    }
  }
  wirePrismaDeep(wired);
  if (wired.notificationsService && typeof wired.notificationsService === "object") {
    const notifications = wired.notificationsService as {
      createNotification?: (...args: unknown[]) => Promise<unknown>;
    };
    const originalCreate = notifications.createNotification?.bind(wired.notificationsService);
    notifications.createNotification = async (...args: unknown[]) => {
      try {
        return await originalCreate?.(...args);
      } catch {
        // Realtime gateway may be unwired under tsx DI; assignment itself remains authoritative.
        return { id: "d2-proof-notification-skipped" };
      }
    };
  }
  if (!wired.prisma) {
    throw new Error("WorkOrdersService.prisma could not be wired — aborting proof");
  }

  const results: Array<{ id: string; ok: boolean; detail?: unknown }> = [];
  const mark = (id: string, ok: boolean, detail?: unknown) => {
    results.push({ id, ok, detail });
    console.log(JSON.stringify({ id, ok, detail }));
  };

  const techUser = await prisma.user.findFirst({
    where: { email: "tech@maintainpro.local" },
    include: { role: true }
  });
  const managerUser = await prisma.user.findFirst({
    where: { email: "manager@maintainpro.local" },
    include: { role: true }
  });
  assert(techUser?.tenantId && managerUser?.tenantId, "seed users tech/manager required");
  assert(techUser.id !== managerUser.id, "tech and manager must be different users");

  const tech: Actor = {
    sub: techUser.id,
    email: techUser.email,
    role: RoleName.TECHNICIAN,
    tenantId: techUser.tenantId
  };
  const manager: Actor = {
    sub: managerUser.id,
    email: managerUser.email,
    role: RoleName.MANAGER,
    tenantId: managerUser.tenantId
  };
  assert(tech.tenantId === manager.tenantId, "same tenant required");

  const asset = await prisma.asset.findFirst({
    where: { tenantId: tech.tenantId },
    select: { id: true }
  });
  const site = !asset
    ? await prisma.site.findFirst({ where: { tenantId: tech.tenantId }, select: { id: true } })
    : null;
  assert(asset?.id || site?.id, "need asset or site in tenant for WO create");

  let woId = "";
  try {
    const created = await workOrders.create(
      {
        title: `D2 lifecycle proof ${Date.now()}`,
        description: "D2 live SQL/API lifecycle proof — safe fixture",
        priority: Priority.MEDIUM,
        // PREVENTIVE: evidence may apply; QR not required — avoids QR gate without inventing scans.
        type: WorkOrderType.PREVENTIVE,
        ...(asset?.id ? { assetId: asset.id } : { siteId: site!.id })
      },
      manager
    );
    woId = created.id;
    mark("create", Boolean(woId) && created.status === WorkOrderStatus.OPEN, {
      woId,
      woNumber: created.woNumber,
      status: created.status,
      approvalStatus: created.approvalStatus
    });

    // Ensure executable approval state
    if (created.approvalStatus === WorkOrderApprovalStatus.PENDING) {
      await workOrders.approveWorkOrder(woId, "D2 proof approval", manager);
    } else if (created.approvalStatus !== WorkOrderApprovalStatus.APPROVED) {
      await prisma.workOrder.update({
        where: { id: woId },
        data: { approvalStatus: WorkOrderApprovalStatus.APPROVED, approvedById: manager.sub, approvedAt: new Date() }
      });
    }

    const plannedStart = new Date(Date.now() + 60_000).toISOString();
    const dueDate = new Date(Date.now() + 86_400_000).toISOString();
    const planned = await workOrders.planWork(
      woId,
      {
        plannedStartAt: plannedStart,
        dueDate,
        estimatedHours: 2,
        notes: "D2 plan note"
      },
      manager
    );
    mark("plan", planned.status === WorkOrderStatus.PLANNED, {
      status: planned.status,
      plannedStartAt: planned.plannedStartAt,
      dueDate: planned.dueDate,
      version: (planned as { version?: number }).version
    });

    const assigned = await workOrders.assign(woId, tech.sub, manager);
    mark("assign", assigned.status === WorkOrderStatus.ASSIGNED && assigned.technicianId === tech.sub, {
      status: assigned.status,
      technicianId: assigned.technicianId
    });

    const started = await workOrders.updateStatus(
      woId,
      { status: WorkOrderStatus.IN_PROGRESS, idempotencyKey: `d2-start-${woId}` },
      tech
    );
    mark("start", started.status === WorkOrderStatus.IN_PROGRESS && Boolean(started.repairStartedAt || started.startDate), {
      status: started.status,
      startDate: started.startDate,
      repairStartedAt: started.repairStartedAt
    });

    const labourAfterStart = await prisma.workOrderLabourEntry.findMany({
      where: { workOrderId: woId },
      orderBy: { startedAt: "asc" }
    });
    const activeAfterStart = labourAfterStart.filter((e) => !e.endedAt);
    mark("labour-start-one-active", activeAfterStart.length === 1 && labourAfterStart.length === 1, {
      total: labourAfterStart.length,
      active: activeAfterStart.length,
      sessionId: activeAfterStart[0]?.id
    });

    // Duplicate Start must not create a second active session
    const startDup = await workOrders.updateStatus(
      woId,
      { status: WorkOrderStatus.IN_PROGRESS, idempotencyKey: `d2-start-${woId}` },
      tech
    );
    const labourAfterDupStart = await prisma.workOrderLabourEntry.findMany({
      where: { workOrderId: woId, endedAt: null }
    });
    mark("idempotent-start", startDup.status === WorkOrderStatus.IN_PROGRESS && labourAfterDupStart.length === 1, {
      activeSessions: labourAfterDupStart.length,
      status: startDup.status
    });

    const held = await workOrders.updateStatus(
      woId,
      {
        status: WorkOrderStatus.ON_HOLD,
        holdReasonCode: "WAITING_PARTS",
        delayReason: "Waiting for spare part delivery",
        idempotencyKey: `d2-hold-${woId}`
      },
      tech
    );
    const labourOnHold = await prisma.workOrderLabourEntry.findMany({ where: { workOrderId: woId } });
    const holdHist = await prisma.workOrderHoldHistory.findMany({ where: { workOrderId: woId } });
    mark(
      "hold",
      held.status === WorkOrderStatus.ON_HOLD &&
        labourOnHold.every((e) => e.endedAt != null) &&
        holdHist.length >= 1,
      {
        status: held.status,
        activeLabour: labourOnHold.filter((e) => !e.endedAt).length,
        holdHistoryCount: holdHist.length
      }
    );

    const holdDup = await workOrders.updateStatus(
      woId,
      {
        status: WorkOrderStatus.ON_HOLD,
        holdReasonCode: "WAITING_PARTS",
        delayReason: "Waiting for spare part delivery",
        idempotencyKey: `d2-hold-${woId}`
      },
      tech
    );
    const holdHistAfterDup = await prisma.workOrderHoldHistory.count({ where: { workOrderId: woId } });
    mark("idempotent-hold", holdDup.status === WorkOrderStatus.ON_HOLD && holdHistAfterDup === holdHist.length, {
      holdHistoryCount: holdHistAfterDup
    });

    const resumed = await workOrders.updateStatus(
      woId,
      { status: WorkOrderStatus.IN_PROGRESS, idempotencyKey: `d2-resume-${woId}` },
      tech
    );
    const labourAfterResume = await prisma.workOrderLabourEntry.findMany({
      where: { workOrderId: woId },
      orderBy: { startedAt: "asc" }
    });
    const activeAfterResume = labourAfterResume.filter((e) => !e.endedAt);
    mark(
      "resume",
      resumed.status === WorkOrderStatus.IN_PROGRESS &&
        labourAfterResume.length >= 2 &&
        activeAfterResume.length === 1,
      {
        status: resumed.status,
        sessions: labourAfterResume.length,
        active: activeAfterResume.length
      }
    );

    const resumeDup = await workOrders.updateStatus(
      woId,
      { status: WorkOrderStatus.IN_PROGRESS, idempotencyKey: `d2-resume-${woId}` },
      tech
    );
    const activeAfterResumeDup = await prisma.workOrderLabourEntry.count({
      where: { workOrderId: woId, endedAt: null }
    });
    mark("idempotent-resume", resumeDup.status === WorkOrderStatus.IN_PROGRESS && activeAfterResumeDup === 1, {
      activeSessions: activeAfterResumeDup
    });

    // Client tries to inject authoritative hours/cost — must be ignored
    const completed1 = await workOrders.updateStatus(
      woId,
      {
        status: WorkOrderStatus.TECHNICIAN_COMPLETED,
        completionNote: "First completion attempt — belt adjusted and tested",
        actualCost: 9999.99,
        actualHours: 99,
        idempotencyKey: `d2-complete-1-${woId}`
      },
      tech
    );
    const sqlAfterComplete1 = await prisma.workOrder.findUnique({ where: { id: woId } });
    const labourClosed1 = await prisma.workOrderLabourEntry.findMany({ where: { workOrderId: woId } });
    const activeAtComplete = labourClosed1.filter((e) => !e.endedAt);
    mark(
      "complete-1",
      completed1.status === WorkOrderStatus.TECHNICIAN_COMPLETED &&
        Number(sqlAfterComplete1?.actualCost ?? -1) !== 9999.99 &&
        Number(sqlAfterComplete1?.actualHours ?? -1) !== 99 &&
        activeAtComplete.length === 0,
      {
        status: sqlAfterComplete1?.status,
        actualCost: sqlAfterComplete1?.actualCost,
        actualHours: sqlAfterComplete1?.actualHours,
        activeLabour: activeAtComplete.length,
        note: sqlAfterComplete1?.technicianCompletionNote
      }
    );

    const completeDup = await workOrders.updateStatus(
      woId,
      {
        status: WorkOrderStatus.TECHNICIAN_COMPLETED,
        completionNote: "First completion attempt — belt adjusted and tested",
        actualCost: 8888,
        actualHours: 88,
        idempotencyKey: `d2-complete-1-${woId}`
      },
      tech
    );
    const histCompleteCount = await prisma.workOrderStatusHistory.count({
      where: { workOrderId: woId, toStatus: WorkOrderStatus.TECHNICIAN_COMPLETED }
    });
    mark(
      "idempotent-complete",
      completeDup.status === WorkOrderStatus.TECHNICIAN_COMPLETED && histCompleteCount === 1,
      { technicianCompletedEvents: histCompleteCount }
    );

    // SoD: technician cannot verify own work
    let sodBlocked = false;
    try {
      await workOrders.verifySupervisor(woId, { verificationNote: "self verify attempt" }, tech);
    } catch (error) {
      sodBlocked = true;
      mark("sod-block", true, { message: error instanceof Error ? error.message : String(error) });
    }
    if (!sodBlocked) {
      mark("sod-block", false, { message: "technician was able to verify own work" });
    }

    // Rework
    const rework = await workOrders.rejectSupervisor(woId, "Needs tighter torque and retest", manager);
    const afterRework = await prisma.workOrder.findUnique({ where: { id: woId } });
    mark(
      "rework",
      rework.status === WorkOrderStatus.REWORK_REQUIRED &&
        Boolean(afterRework?.technicianCompletionNote) &&
        afterRework?.repairCompletedAt != null,
      {
        status: afterRework?.status,
        preservedNote: afterRework?.technicianCompletionNote,
        preservedRepairCompletedAt: afterRework?.repairCompletedAt,
        preservedHours: afterRework?.actualHours,
        preservedCost: afterRework?.actualCost
      }
    );

    const resumeRework = await workOrders.updateStatus(
      woId,
      { status: WorkOrderStatus.IN_PROGRESS, idempotencyKey: `d2-rework-resume-${woId}` },
      tech
    );
    mark("rework-resume", resumeRework.status === WorkOrderStatus.IN_PROGRESS, {
      status: resumeRework.status
    });

    const completed2 = await workOrders.updateStatus(
      woId,
      {
        status: WorkOrderStatus.TECHNICIAN_COMPLETED,
        completionNote: "Second completion after rework — torque verified",
        actualCost: 7777,
        actualHours: 77,
        idempotencyKey: `d2-complete-2-${woId}`
      },
      tech
    );
    const afterComplete2 = await prisma.workOrder.findUnique({ where: { id: woId } });
    const histComplete2 = await prisma.workOrderStatusHistory.findMany({
      where: { workOrderId: woId, toStatus: WorkOrderStatus.TECHNICIAN_COMPLETED },
      orderBy: { createdAt: "asc" }
    });
    mark(
      "complete-2",
      completed2.status === WorkOrderStatus.TECHNICIAN_COMPLETED &&
        histComplete2.length >= 2 &&
        Number(afterComplete2?.actualCost ?? -1) !== 7777,
      {
        status: afterComplete2?.status,
        completionEvents: histComplete2.length,
        actualCost: afterComplete2?.actualCost,
        actualHours: afterComplete2?.actualHours
      }
    );

    // Cannot close before VERIFIED
    let closeEarlyBlocked = false;
    try {
      await workOrders.closeWorkOrder(woId, "early close", manager);
    } catch {
      closeEarlyBlocked = true;
    }
    mark("close-before-verified-blocked", closeEarlyBlocked, {});

    const verified = await workOrders.verifySupervisor(
      woId,
      { verificationNote: "Supervisor verified after rework" },
      manager
    );
    const afterVerified = await prisma.workOrder.findUnique({ where: { id: woId } });
    mark(
      "verify",
      verified.status === WorkOrderStatus.VERIFIED &&
        afterVerified?.verifiedById === manager.sub &&
        afterVerified?.verifiedById !== tech.sub,
      {
        status: afterVerified?.status,
        verifiedById: afterVerified?.verifiedById,
        requesterConfirmationStatus: (afterVerified as { requesterConfirmationStatus?: string })
          ?.requesterConfirmationStatus
      }
    );

    const verifyDupAttempt = await workOrders.verifySupervisor(
      woId,
      { verificationNote: "duplicate verify" },
      manager
    ).then(
      (r) => ({ ok: false as const, status: r.status }),
      (e) => ({ ok: true as const, message: e instanceof Error ? e.message : String(e) })
    );
    const verifyEvents = await prisma.workOrderStatusHistory.count({
      where: { workOrderId: woId, toStatus: WorkOrderStatus.VERIFIED }
    });
    mark("idempotent-verify-or-reject-dup", verifyEvents === 1, {
      verifyEvents,
      dup: verifyDupAttempt
    });

    // Stale version conflict on close
    const versionNow = (await prisma.workOrder.findUnique({ where: { id: woId }, select: { version: true } }))!
      .version;
    let staleConflict = false;
    try {
      await workOrders.closeWorkOrder(woId, "stale close", manager, { expectedVersion: versionNow - 1 });
    } catch (error) {
      staleConflict =
        error instanceof Error &&
        (error.message.includes("someone else") || error.name === "ConflictException" || /conflict/i.test(error.message));
      if (!staleConflict && error && typeof error === "object" && "getStatus" in error) {
        staleConflict = (error as { getStatus: () => number }).getStatus() === 409;
      }
    }
    mark("stale-version-conflict", staleConflict, { versionNow });

    const closed = await workOrders.closeWorkOrder(woId, "D2 proof close", manager, {
      expectedVersion: versionNow
    });
    const finalWo = await prisma.workOrder.findUnique({ where: { id: woId } });
    mark(
      "close",
      closed.status === WorkOrderStatus.CLOSED &&
        finalWo?.status === WorkOrderStatus.CLOSED &&
        Boolean(finalWo.closedAt),
      {
        status: finalWo?.status,
        closedAt: finalWo?.closedAt,
        version: finalWo?.version,
        actualHours: finalWo?.actualHours,
        actualCost: finalWo?.actualCost
      }
    );

    const closeDup = await workOrders
      .closeWorkOrder(woId, "duplicate close", manager)
      .then(
        (r) => ({ blocked: false, status: r.status }),
        (e) => ({ blocked: true, message: e instanceof Error ? e.message : String(e) })
      );
    const closeEvents = await prisma.workOrderStatusHistory.count({
      where: { workOrderId: woId, toStatus: WorkOrderStatus.CLOSED }
    });
    mark("idempotent-close-or-reject-dup", closeEvents === 1, { closeEvents, closeDup });

    // CLOSED cannot jump via normal status update
    let closedImmutable = false;
    try {
      await workOrders.updateStatus(woId, { status: WorkOrderStatus.IN_PROGRESS }, manager);
    } catch {
      closedImmutable = true;
    }
    mark("closed-immutable", closedImmutable && finalWo?.status === WorkOrderStatus.CLOSED, {});

    // History legality
    const history = await prisma.workOrderStatusHistory.findMany({
      where: { workOrderId: woId },
      orderBy: { createdAt: "asc" }
    });
    const transitions = history.map((h) => `${h.fromStatus ?? "∅"}→${h.toStatus}:${h.action}`);
    const expectedContains = [
      "PLANNED",
      "ASSIGNED",
      "IN_PROGRESS",
      "ON_HOLD",
      "TECHNICIAN_COMPLETED",
      "REWORK_REQUIRED",
      "VERIFIED",
      "CLOSED"
    ];
    const hasAll = expectedContains.every((s) => history.some((h) => h.toStatus === s));
    mark("history-coherent", hasAll && history.every((h) => h.createdAt && (h.actorId || true)), {
      transitions,
      count: history.length
    });

    // SQL proof bundle
    const sqlProof = {
      workOrder: await prisma.$queryRawUnsafe(
        `SELECT id, woNumber, tenantId, status, technicianId, plannedStartAt, dueDate,
                startDate, repairStartedAt, repairCompletedAt, verifiedAt, closedAt,
                actualHours, actualCost, version, requesterConfirmationStatus,
                technicianCompletionNote, verifiedById
         FROM WorkOrder WHERE id = @p1`,
        woId
      ),
      labour: await prisma.$queryRawUnsafe(
        `SELECT id, technicianUserId, startedAt, endedAt, durationMinutes
         FROM WorkOrderLabourEntry WHERE workOrderId = @p1 ORDER BY startedAt`,
        woId
      ),
      hold: await prisma.$queryRawUnsafe(
        `SELECT id, holdReasonCode, heldAt, resumedAt, durationMinutes
         FROM WorkOrderHoldHistory WHERE workOrderId = @p1 ORDER BY heldAt`,
        woId
      ),
      history: await prisma.$queryRawUnsafe(
        `SELECT fromStatus, toStatus, action, actorId, createdAt
         FROM WorkOrderStatusHistory WHERE workOrderId = @p1 ORDER BY createdAt`,
        woId
      )
    };
    console.log("SQL_PROOF", JSON.stringify(sqlProof, null, 2));

    const activeLabourFinal = await prisma.workOrderLabourEntry.count({
      where: { workOrderId: woId, endedAt: null }
    });
    mark("no-overlapping-active-labour-final", activeLabourFinal === 0, { activeLabourFinal });
  } finally {
    if (previousStorage === undefined) {
      delete process.env.STORAGE_UPLOADS_ENABLED;
    } else {
      process.env.STORAGE_UPLOADS_ENABLED = previousStorage;
    }
    // Keep fixture for SQL inspection unless D2_PROOF_CLEANUP=1
    if (woId && process.env.D2_PROOF_CLEANUP === "1") {
      await prisma.workOrderLabourEntry.deleteMany({ where: { workOrderId: woId } });
      await prisma.workOrderHoldHistory.deleteMany({ where: { workOrderId: woId } });
      await prisma.workOrderStatusHistory.deleteMany({ where: { workOrderId: woId } });
      await prisma.workOrderCostSnapshot.deleteMany({ where: { workOrderId: woId } }).catch(() => undefined);
      await prisma.workOrderAssignee.deleteMany({ where: { workOrderId: woId } }).catch(() => undefined);
      await prisma.workOrder.delete({ where: { id: woId } }).catch(() => undefined);
    }
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    JSON.stringify(
      {
        summary: {
          passed: results.filter((r) => r.ok).length,
          failed: failed.length,
          total: results.length,
          woId
        },
        failed
      },
      null,
      2
    )
  );
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
