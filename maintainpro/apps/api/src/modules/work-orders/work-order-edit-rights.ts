import { ForbiddenException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

/**
 * Business rule (2026-10, agreed with the maintenance lead): once a job is created, the
 * description of the work itself (title, description, cost and hour estimates) may only be
 * changed by Admin or Super Admin. This stops a job being quietly rewritten after it was
 * approved, assigned or costed.
 *
 * Managers (and the other planning roles allowed on PATCH /work-orders/:id) still change the
 * planning fields — technician, planned dates and due date — because they run the daily
 * schedule. Priority has its own endpoint and is unaffected.
 */
export const JOB_DETAIL_FIELDS = ["title", "description", "estimatedCost", "estimatedHours"] as const;

const JOB_DETAIL_EDIT_ROLES = new Set<string>([RoleName.SUPER_ADMIN, RoleName.ADMIN]);

function sameValue(current: unknown, next: unknown): boolean {
  if (next === undefined) return true;
  if (typeof current === "string" || typeof next === "string") {
    return String(current ?? "").trim() === String(next ?? "").trim();
  }
  if (current == null || next == null) return current == next;
  return Number(current) === Number(next);
}

/** Throws 403 when a non-admin tries to change any job-detail field to a different value. */
export function assertJobDetailsEditableBy(
  role: string | null | undefined,
  existing: Partial<Record<(typeof JOB_DETAIL_FIELDS)[number], unknown>>,
  data: Partial<Record<(typeof JOB_DETAIL_FIELDS)[number], unknown>>
) {
  if (role && JOB_DETAIL_EDIT_ROLES.has(role)) return;
  const changed = JOB_DETAIL_FIELDS.filter((field) => !sameValue(existing[field], data[field]));
  if (changed.length > 0) {
    throw new ForbiddenException({
      message:
        "Only an Admin or Super Admin can change the job details (title, description, cost or hours) after the job is created. You can still change the technician and the dates.",
      code: "JOB_DETAILS_ADMIN_ONLY",
      metadata: { fields: changed }
    });
  }
}
