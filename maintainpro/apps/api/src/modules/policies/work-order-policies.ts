import { RoleName, WorkOrderApprovalStatus, WorkOrderStatus } from "@prisma/client";

import {
  ALLOWED_STATUS_TRANSITIONS,
  canReopenWorkOrder,
  SUPERVISOR_ROLES,
  TERMINAL_WORK_ORDER_STATUSES
} from "../../common/utils/work-order-governance";
import { allow, deny, firstDenial, type PolicyDecision } from "./policy-decision";

export type WorkOrderPolicyInput = {
  tenantId?: string | null;
  fromStatus?: WorkOrderStatus | string | null;
  toStatus?: WorkOrderStatus | string | null;
  assigned?: boolean;
  approvalStatus?: WorkOrderApprovalStatus | string | null;
  evidenceComplete?: boolean;
  partsComplete?: boolean;
  actorRole?: RoleName | string | null;
  actorIsCreator?: boolean;
  reopenAuthorized?: boolean;
  expectedUpdatedAt?: string | Date | null;
  actualUpdatedAt?: string | Date | null;
};

export function canWorkOrderTransition(input: WorkOrderPolicyInput): PolicyDecision {
  return firstDenial(requireTenant(input.tenantId), requireTransition(input.fromStatus, input.toStatus));
}

export function canWorkOrderStart(input: WorkOrderPolicyInput): PolicyDecision {
  return firstDenial(
    requireTenant(input.tenantId),
    requireTransition(input.fromStatus, WorkOrderStatus.IN_PROGRESS),
    input.assigned === false ? deny("WO_ASSIGNMENT_REQUIRED") : allow(),
    approvalRequired(input.approvalStatus)
  );
}

export function canWorkOrderComplete(input: WorkOrderPolicyInput): PolicyDecision {
  return firstDenial(
    requireTenant(input.tenantId),
    requireTransition(input.fromStatus, input.toStatus ?? WorkOrderStatus.COMPLETED),
    approvalRequired(input.approvalStatus),
    input.assigned === false ? deny("WO_ASSIGNMENT_REQUIRED") : allow(),
    input.evidenceComplete === false ? deny("WO_EVIDENCE_REQUIRED", undefined, "HIGH") : allow(),
    input.partsComplete === false ? deny("WO_PARTS_INCOMPLETE") : allow()
  );
}

export function canWorkOrderReopen(input: WorkOrderPolicyInput): PolicyDecision {
  const role = input.actorRole as RoleName | undefined;
  const authorized = input.reopenAuthorized ?? canReopenWorkOrder(role);
  return firstDenial(
    requireTenant(input.tenantId),
    authorized ? allow() : deny("WO_REOPEN_UNAUTHORIZED", { role: input.actorRole }, "CRITICAL"),
    input.actorIsCreator && !SUPERVISOR_ROLES.has(role as RoleName)
      ? deny("WO_SOD_VIOLATION", { role: input.actorRole }, "CRITICAL")
      : allow()
  );
}

export function canUserApprove(input: { tenantId?: string | null; role?: string | null; allowedRoles?: string[] }): PolicyDecision {
  if (!input.tenantId) {
    return deny("TENANT_REQUIRED", undefined, "CRITICAL");
  }
  const allowed = input.allowedRoles ?? ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"];
  if (!input.role || !allowed.includes(input.role)) {
    return deny("USER_APPROVAL_UNAUTHORIZED", { role: input.role });
  }
  return allow();
}

export function canUserReview(input: { tenantId?: string | null; role?: string | null; allowedRoles?: string[] }): PolicyDecision {
  if (!input.tenantId) {
    return deny("TENANT_REQUIRED", undefined, "CRITICAL");
  }
  const allowed = input.allowedRoles ?? ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "VIEWER"];
  if (!input.role || !allowed.includes(input.role)) {
    return deny("USER_REVIEW_UNAUTHORIZED", { role: input.role });
  }
  return allow();
}

export function assertWorkOrderConcurrency(input: WorkOrderPolicyInput): PolicyDecision {
  if (!input.expectedUpdatedAt || !input.actualUpdatedAt) {
    return allow();
  }
  const expected = new Date(input.expectedUpdatedAt).getTime();
  const actual = new Date(input.actualUpdatedAt).getTime();
  if (Number.isFinite(expected) && Number.isFinite(actual) && expected !== actual) {
    return deny("WO_CONCURRENCY_CONFLICT", { expected, actual }, "HIGH");
  }
  return allow();
}

function requireTenant(tenantId?: string | null): PolicyDecision {
  return tenantId ? allow() : deny("TENANT_REQUIRED", undefined, "CRITICAL");
}

function requireTransition(from?: string | null, to?: string | null): PolicyDecision {
  if (!from || !to) {
    return deny("WO_INVALID_TRANSITION", { from, to }, "CRITICAL");
  }
  if (from === to) {
    return allow();
  }
  if (TERMINAL_WORK_ORDER_STATUSES.has(from as WorkOrderStatus) && to !== WorkOrderStatus.OPEN) {
    return deny("WO_INVALID_TRANSITION", { from, to }, "CRITICAL");
  }
  const allowed = ALLOWED_STATUS_TRANSITIONS[from as WorkOrderStatus] ?? [];
  if (!allowed.includes(to as WorkOrderStatus)) {
    return deny("WO_INVALID_TRANSITION", { from, to });
  }
  return allow();
}

function approvalRequired(status?: string | null): PolicyDecision {
  if (!status) {
    return allow();
  }
  if (status === WorkOrderApprovalStatus.REJECTED || status === WorkOrderApprovalStatus.PENDING) {
    return deny("WO_APPROVAL_REQUIRED", { approvalStatus: status });
  }
  return allow();
}
