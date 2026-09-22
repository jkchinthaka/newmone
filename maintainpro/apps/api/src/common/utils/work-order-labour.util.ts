import { BadRequestException, ConflictException } from "@nestjs/common";

export type LabourSessionRow = {
  id: string;
  technicianUserId?: string | null;
  startedAt: Date;
  endedAt?: Date | null;
  durationMinutes?: number | null;
};

/** Sum authoritative labour hours from closed sessions (server timestamps). */
export function sumLabourHours(entries: LabourSessionRow[]): number {
  let minutes = 0;
  for (const entry of entries) {
    if (entry.durationMinutes != null && Number.isFinite(entry.durationMinutes)) {
      minutes += Math.max(0, entry.durationMinutes);
      continue;
    }
    if (entry.endedAt && entry.startedAt) {
      const diff = Math.max(0, entry.endedAt.getTime() - entry.startedAt.getTime());
      minutes += Math.round(diff / 60_000);
    }
  }
  return Math.round((minutes / 60) * 100) / 100;
}

export function assertNoActiveLabourForTechnician(
  activeOnOtherWorkOrders: { id: string; workOrderId: string }[],
  currentWorkOrderId: string
) {
  const conflict = activeOnOtherWorkOrders.find((row) => row.workOrderId !== currentWorkOrderId);
  if (conflict) {
    throw new ConflictException(
      `Technician already has an active labour session on another work order (${conflict.workOrderId}). Complete or hold that job first.`
    );
  }
}

export function assertSingleActiveSessionOnWorkOrder(activeOnThis: LabourSessionRow[]) {
  if (activeOnThis.length > 1) {
    throw new ConflictException("Work order has multiple active labour sessions — refresh and retry.");
  }
}

export function closeLabourSessionTimestamps(startedAt: Date, endedAt: Date = new Date()) {
  const durationMinutes = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000));
  return { endedAt, durationMinutes };
}

export function assertLabourCorrectionReason(reason?: string | null) {
  const trimmed = reason?.trim() ?? "";
  if (trimmed.length < 3) {
    throw new BadRequestException("Labour correction reason is required (minimum 3 characters).");
  }
  return trimmed;
}
