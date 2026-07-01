import { ForbiddenException } from "@nestjs/common";
import { RoleName, WorkOrderAssigneeStatus, WorkOrderStatus } from "@prisma/client";

import type { JwtPayload } from "../../modules/auth/auth.types";

const EVIDENCE_UPLOAD_ROLES = new Set<RoleName>([
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
  RoleName.MANAGER,
  RoleName.OPERATIONS_MANAGER,
  RoleName.ASSET_MANAGER,
  RoleName.MECHANIC,
  RoleName.TECHNICIAN
]);

const EVIDENCE_REVIEW_ROLES = new Set<RoleName>([
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
  RoleName.MANAGER,
  RoleName.OPERATIONS_MANAGER,
  RoleName.ASSET_MANAGER,
  RoleName.SUPERVISOR
]);

const QR_OVERRIDE_ROLES = new Set<RoleName>([
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
  RoleName.MANAGER,
  RoleName.OPERATIONS_MANAGER,
  RoleName.ASSET_MANAGER,
  RoleName.SUPERVISOR
]);

const COMPLETION_OVERRIDE_ROLES = new Set<RoleName>([
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
  RoleName.MANAGER,
  RoleName.OPERATIONS_MANAGER
]);

const TECHNICIAN_FIELD_ROLES = new Set<RoleName>([RoleName.TECHNICIAN, RoleName.MECHANIC]);

const POST_COMPLETION_STATUSES = new Set<WorkOrderStatus>([
  WorkOrderStatus.TECHNICIAN_COMPLETED,
  WorkOrderStatus.COMPLETED,
  WorkOrderStatus.CANCELLED
]);

export function canUploadEvidence(role?: RoleName | string | null): boolean {
  return role ? EVIDENCE_UPLOAD_ROLES.has(role as RoleName) : false;
}

export function canReviewEvidence(role?: RoleName | string | null): boolean {
  return role ? EVIDENCE_REVIEW_ROLES.has(role as RoleName) : false;
}

export function canOverrideQrMismatch(role?: RoleName | string | null): boolean {
  return role ? QR_OVERRIDE_ROLES.has(role as RoleName) : false;
}

export function canOverrideCompletionBlock(role?: RoleName | string | null): boolean {
  return role ? COMPLETION_OVERRIDE_ROLES.has(role as RoleName) : false;
}

export function isTechnicianFieldRole(role?: RoleName | string | null): boolean {
  return role ? TECHNICIAN_FIELD_ROLES.has(role as RoleName) : false;
}

export function evidenceDeleteBlockedAfterCompletion(status: WorkOrderStatus): boolean {
  return POST_COMPLETION_STATUSES.has(status);
}

export async function assertTechnicianAssignedToWorkOrder(input: {
  actor: Pick<JwtPayload, "sub" | "role">;
  workOrderId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: { workOrderAssignee: { findFirst: (args: any) => Promise<{ id: string } | null> } };
}) {
  if (!isTechnicianFieldRole(input.actor.role)) {
    return;
  }

  const assignee = await input.prisma.workOrderAssignee.findFirst({
    where: {
      workOrderId: input.workOrderId,
      assignmentStatus: { not: WorkOrderAssigneeStatus.REMOVED },
      employee: { linkedUserId: input.actor.sub }
    },
    select: { id: true }
  });

  if (!assignee) {
    throw new ForbiddenException("You can only upload evidence for work orders assigned to you.");
  }
}
