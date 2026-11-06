import { BadRequestException } from "@nestjs/common";
import type { RoleName } from "@prisma/client";

import { canOverrideCompletionBlock } from "../../common/utils/work-order-evidence-rbac";

export const TASK_STATUSES = ["NOT_STARTED", "WORKING", "DONE"] as const;
export type WorkOrderTaskStatus = (typeof TASK_STATUSES)[number];

type TaskCounter = {
  workOrderTask: { count: (args: { where: Record<string, unknown> }) => Promise<number> };
};

/**
 * A job with tasks can only be completed when every task is DONE.
 * Admin / Manager / Ops Manager may override with a written reason. Jobs without tasks are unaffected.
 */
export async function assertAllTasksDone(
  db: TaskCounter,
  workOrderId: string,
  opts: { role?: RoleName | string | null; overrideReason?: string | null }
) {
  const open = await db.workOrderTask.count({
    where: { workOrderId, status: { not: "DONE" } }
  });
  if (open === 0) return;
  if (opts.overrideReason?.trim() && canOverrideCompletionBlock(opts.role)) return;
  throw new BadRequestException(
    `${open} task${open === 1 ? "" : "s"} still not done. Finish all tasks before completing the job.`
  );
}

export function minutesBetween(from: Date | null | undefined, to: Date): number | null {
  if (!from) return null;
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 60000));
}
