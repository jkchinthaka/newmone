import { MaintenanceRequestStatus, NotificationPriority, NotificationType, Prisma } from "@prisma/client";

import { assertValidTransition } from "./request-lifecycle";

type Db = {
  maintenanceRequest: {
    findFirst: (args: Prisma.MaintenanceRequestFindFirstArgs) => Promise<{
      id: string;
      requestNumber: string;
      reportedById: string;
      status: string;
    } | null>;
    updateMany: (args: Prisma.MaintenanceRequestUpdateManyArgs) => Promise<{ count: number }>;
  };
  maintenanceRequestHistory: { create: (args: Prisma.MaintenanceRequestHistoryCreateArgs) => Promise<unknown> };
  evidenceAttachment: { updateMany: (args: Prisma.EvidenceAttachmentUpdateManyArgs) => Promise<unknown> };
  workOrder: { updateMany: (args: Prisma.WorkOrderUpdateManyArgs) => Promise<unknown> };
};

type Notifier = {
  createNotification: (input: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    priority?: NotificationPriority;
    referenceId?: string;
    referenceType?: string;
    dedupeKey?: string;
  }) => Promise<unknown>;
};

export type WorkOrderExitOutcome = "REJECTED" | "CANCELLED";

/**
 * A converted request must not be stranded when its work order is rejected or cancelled:
 * send it back to UNDER_REVIEW (re-approve, then re-convert), drop the link and tell the reporter why.
 * Idempotent — does nothing unless the request is still CONVERTED_TO_WO on this work order.
 */
export async function reopenRequestAfterWorkOrderExit(
  prisma: unknown,
  notifications: Notifier | undefined,
  input: {
    tenantId: string;
    workOrderId: string;
    woNumber?: string | null;
    outcome: WorkOrderExitOutcome;
    reason: string;
    actorId?: string | null;
  }
): Promise<{ requestId: string } | null> {
  const db = prisma as Partial<Db> & { $transaction?: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };
  if (typeof db.maintenanceRequest?.findFirst !== "function") return null;

  const request = await db.maintenanceRequest.findFirst({
    where: {
      tenantId: input.tenantId,
      workOrderId: input.workOrderId,
      status: MaintenanceRequestStatus.CONVERTED_TO_WO
    },
    select: { id: true, requestNumber: true, reportedById: true, status: true }
  });
  if (!request) return null;
  assertValidTransition(MaintenanceRequestStatus.CONVERTED_TO_WO, MaintenanceRequestStatus.UNDER_REVIEW);

  const verb = input.outcome === "REJECTED" ? "rejected" : "cancelled";
  const woLabel = input.woNumber ? `Work order ${input.woNumber}` : "The work order";
  const note = `${woLabel} was ${verb}: ${input.reason}`.slice(0, 1000);

  const apply = async (tx: Db) => {
    const claimed = await tx.maintenanceRequest.updateMany({
      where: {
        id: request.id,
        tenantId: input.tenantId,
        workOrderId: input.workOrderId,
        status: MaintenanceRequestStatus.CONVERTED_TO_WO
      },
      data: {
        status: MaintenanceRequestStatus.UNDER_REVIEW,
        workOrderId: null,
        convertedAt: null,
        approvedAt: null,
        publicUpdateNote: note,
        version: { increment: 1 }
      }
    });
    if (claimed.count === 0) return false;
    await tx.maintenanceRequestHistory.create({
      data: {
        tenantId: input.tenantId,
        requestId: request.id,
        fromStatus: MaintenanceRequestStatus.CONVERTED_TO_WO,
        toStatus: MaintenanceRequestStatus.UNDER_REVIEW,
        action: input.outcome === "REJECTED" ? "WORK_ORDER_REJECTED" : "WORK_ORDER_CANCELLED",
        reason: input.reason,
        actorId: input.actorId ?? undefined,
        metadata: JSON.stringify({ workOrderId: input.workOrderId, woNumber: input.woNumber ?? null }),
        isInternal: false
      }
    });
    // Request photos follow the next conversion instead of staying on the dead work order.
    await tx.evidenceAttachment.updateMany({
      where: { tenantId: input.tenantId, maintenanceRequestId: request.id, workOrderId: input.workOrderId },
      data: { workOrderId: null }
    });
    // The default conversion key would otherwise return this cancelled work order on re-convert.
    await tx.workOrder.updateMany({
      where: { id: input.workOrderId, tenantId: input.tenantId, lastIdempotencyKey: `mr-convert:${request.id}` },
      data: { lastIdempotencyKey: null }
    });
    return true;
  };

  const reopened =
    typeof db.$transaction === "function" ? await db.$transaction((tx) => apply(tx)) : await apply(db as Db);
  if (!reopened) return null;

  try {
    await notifications?.createNotification({
      userId: request.reportedById,
      type: NotificationType.SYSTEM_ALERT,
      title: `${request.requestNumber} is back under review`,
      message: note,
      priority: NotificationPriority.WARNING,
      referenceId: request.id,
      referenceType: "MaintenanceRequest",
      dedupeKey: `mr-wo-${verb}:${request.id}:${input.workOrderId}`
    });
  } catch {
    // The reopen stays saved when a notice cannot be written.
  }
  return { requestId: request.id };
}
