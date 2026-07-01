import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { RoleName, WorkOrderStatus, WorkOrderType } from "@prisma/client";

export const GOVERNANCE_MIN_REASON_LENGTH = 3;

/** Statuses where work has started and sensitive fields are locked. */
export const WORK_STARTED_STATUSES = new Set<WorkOrderStatus>([
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.TECHNICIAN_COMPLETED,
  WorkOrderStatus.REWORK_REQUIRED,
  WorkOrderStatus.COMPLETED,
  WorkOrderStatus.OVERDUE
]);

export const TERMINAL_WORK_ORDER_STATUSES = new Set<WorkOrderStatus>([
  WorkOrderStatus.COMPLETED,
  WorkOrderStatus.CANCELLED
]);

export const SUPERVISOR_ROLES = new Set<RoleName>([
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
  RoleName.MANAGER,
  RoleName.OPERATIONS_MANAGER,
  RoleName.ASSET_MANAGER
]);

export const ADMIN_RESET_ROLES = new Set<RoleName>([
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN
]);

export const TECHNICIAN_EXECUTION_ROLES = new Set<RoleName>([
  RoleName.TECHNICIAN,
  RoleName.MECHANIC
]);

/** Work order types that require before/after evidence when storage is enabled. */
export const EVIDENCE_REQUIRED_TYPES = new Set<WorkOrderType>([
  WorkOrderType.CORRECTIVE,
  WorkOrderType.EMERGENCY,
  WorkOrderType.ACCIDENT_REPAIR,
  WorkOrderType.PREVENTIVE,
  WorkOrderType.INSPECTION
]);

export const ALLOWED_STATUS_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  [WorkOrderStatus.OPEN]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ON_HOLD, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.IN_PROGRESS]: [
    WorkOrderStatus.ON_HOLD,
    WorkOrderStatus.TECHNICIAN_COMPLETED,
    WorkOrderStatus.CANCELLED
  ],
  [WorkOrderStatus.ON_HOLD]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.TECHNICIAN_COMPLETED]: [WorkOrderStatus.REWORK_REQUIRED],
  [WorkOrderStatus.REWORK_REQUIRED]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.COMPLETED]: [],
  [WorkOrderStatus.CANCELLED]: [],
  [WorkOrderStatus.OVERDUE]: [
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.ON_HOLD,
    WorkOrderStatus.TECHNICIAN_COMPLETED,
    WorkOrderStatus.CANCELLED
  ]
};

const BACKWARD_TO_OPEN_SOURCES = new Set<WorkOrderStatus>([
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.TECHNICIAN_COMPLETED,
  WorkOrderStatus.REWORK_REQUIRED,
  WorkOrderStatus.COMPLETED,
  WorkOrderStatus.CANCELLED
]);

export function assertReasonProvided(label: string, reason?: string | null) {
  const trimmed = reason?.trim() ?? "";
  if (trimmed.length < GOVERNANCE_MIN_REASON_LENGTH) {
    throw new BadRequestException(`${label} is required (minimum ${GOVERNANCE_MIN_REASON_LENGTH} characters).`);
  }
  return trimmed;
}

export function isWorkStarted(status: WorkOrderStatus): boolean {
  return WORK_STARTED_STATUSES.has(status);
}

export function requiresSupervisorVerification(input: {
  type: WorkOrderType;
  priority: string;
}): boolean {
  return (
    input.type === WorkOrderType.EMERGENCY ||
    input.type === WorkOrderType.ACCIDENT_REPAIR ||
    input.type === WorkOrderType.CORRECTIVE ||
    input.priority === "HIGH" ||
    input.priority === "CRITICAL"
  );
}

export function requiresEvidenceForCompletion(type: WorkOrderType): boolean {
  return EVIDENCE_REQUIRED_TYPES.has(type);
}

export function canDirectlyCloseWorkOrder(role?: RoleName | null): boolean {
  return role === RoleName.SUPER_ADMIN || role === RoleName.ADMIN;
}

export function canVerifySupervisor(role?: RoleName | null): boolean {
  return role ? SUPERVISOR_ROLES.has(role) : false;
}

export function canReopenWorkOrder(role?: RoleName | null): boolean {
  return role ? ADMIN_RESET_ROLES.has(role) : false;
}

export function assertAllowedStatusTransition(from: WorkOrderStatus, to: WorkOrderStatus) {
  if (from === to) {
    return;
  }

  if (to === WorkOrderStatus.OPEN && BACKWARD_TO_OPEN_SOURCES.has(from)) {
    throw new BadRequestException(
      "Work orders cannot move back to Open. Use the controlled reopen action with reason and audit logging."
    );
  }

  if (TERMINAL_WORK_ORDER_STATUSES.has(from)) {
    throw new BadRequestException(`Cannot change status from ${from.replaceAll("_", " ")}`);
  }

  const allowed = ALLOWED_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BadRequestException(`Status transition from ${from.replaceAll("_", " ")} to ${to.replaceAll("_", " ")} is not allowed`);
  }
}

export function assertRoleCanSetStatus(
  role: RoleName | undefined,
  from: WorkOrderStatus,
  to: WorkOrderStatus,
  options?: { emergencyCloseReason?: string }
) {
  if (to === WorkOrderStatus.COMPLETED) {
    if (from === WorkOrderStatus.TECHNICIAN_COMPLETED && canVerifySupervisor(role)) {
      return;
    }
    if (canDirectlyCloseWorkOrder(role) && options?.emergencyCloseReason?.trim()) {
      return;
    }
    throw new ForbiddenException(
      "Technicians must mark jobs as Technician Completed. Supervisor verification is required before closing."
    );
  }

  if (to === WorkOrderStatus.TECHNICIAN_COMPLETED && role && !TECHNICIAN_EXECUTION_ROLES.has(role) && !canVerifySupervisor(role)) {
    throw new ForbiddenException("Only technicians or supervisors can mark technician completion.");
  }

  if (to === WorkOrderStatus.CANCELLED && !canVerifySupervisor(role) && role !== RoleName.TECHNICIAN && role !== RoleName.MECHANIC) {
    // Technicians can cancel with reason; supervisors/managers always can
    return;
  }
}

export type SensitiveWorkOrderFields = {
  assetId?: string | null;
  vehicleId?: string | null;
  priority?: string;
  type?: WorkOrderType;
  dueDate?: string | Date | null;
  expectedCompletionDate?: string | Date | null;
  plannedStartAt?: string | Date | null;
  plannedEndAt?: string | Date | null;
};

export function assertSensitiveFieldsUnlocked(
  status: WorkOrderStatus,
  patch: SensitiveWorkOrderFields,
  options?: { overrideReason?: string; actorRole?: RoleName | null }
) {
  if (!isWorkStarted(status)) {
    return;
  }

  const touched =
    patch.assetId !== undefined ||
    patch.vehicleId !== undefined ||
    patch.priority !== undefined ||
    patch.type !== undefined ||
    patch.dueDate !== undefined ||
    patch.expectedCompletionDate !== undefined ||
    patch.plannedStartAt !== undefined ||
    patch.plannedEndAt !== undefined;

  if (!touched) {
    return;
  }

  if (options?.overrideReason?.trim() && options.actorRole && canDirectlyCloseWorkOrder(options.actorRole)) {
    return;
  }

  throw new BadRequestException(
    "This work order is locked because work has already started. Sensitive fields require a controlled update with reason, permission, and audit logging."
  );
}
