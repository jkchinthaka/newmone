import { RoleName } from "@prisma/client";

export type DeactivateUserInput = {
  actorId: string;
  targetUserId: string;
  targetRole: RoleName | string;
  targetIsActive: boolean;
  nextIsActive: boolean;
  activeAdminCount: number;
  openWorkOrderIds?: string[];
};

export type DeactivateDecision = {
  allowed: boolean;
  code: string;
  requireReassignment: boolean;
  openWorkOrderIds: string[];
  message: string;
};

/**
 * Admin safety: no unsafe delete — deactivate only, protect last admin,
 * prevent self-lockout of critical access, require reassignment for techs with open jobs.
 */
export function evaluateUserDeactivation(input: DeactivateUserInput): DeactivateDecision {
  const openWorkOrderIds = input.openWorkOrderIds ?? [];

  if (input.nextIsActive) {
    return {
      allowed: true,
      code: "REACTIVATE_OK",
      requireReassignment: false,
      openWorkOrderIds: [],
      message: "Reactivation allowed"
    };
  }

  if (input.actorId === input.targetUserId) {
    return {
      allowed: false,
      code: "SELF_DEACTIVATE_BLOCKED",
      requireReassignment: false,
      openWorkOrderIds,
      message: "Cannot deactivate your own account"
    };
  }

  const adminRoles = new Set(["SUPER_ADMIN", "ADMIN"]);
  if (adminRoles.has(String(input.targetRole)) && input.activeAdminCount <= 1) {
    return {
      allowed: false,
      code: "LAST_ADMIN_PROTECTED",
      requireReassignment: false,
      openWorkOrderIds,
      message: "Last critical admin must not be deactivated"
    };
  }

  const techRoles = new Set(["TECHNICIAN", "MECHANIC", "ASSET_MANAGER"]);
  if (techRoles.has(String(input.targetRole)) && openWorkOrderIds.length > 0) {
    return {
      allowed: false,
      code: "OPEN_WORK_REQUIRES_REASSIGNMENT",
      requireReassignment: true,
      openWorkOrderIds,
      message: "Reassign open work before deactivating technician"
    };
  }

  return {
    allowed: true,
    code: "DEACTIVATE_OK",
    requireReassignment: false,
    openWorkOrderIds: [],
    message: "Deactivation allowed (soft deactivate — no delete)"
  };
}

export type ConfigChangeGuardInput = {
  confirmed: boolean;
  impactPreviewProvided: boolean;
  reason?: string | null;
  effectiveFrom?: Date | null;
};

export function evaluateHighImpactConfigChange(input: ConfigChangeGuardInput): {
  allowed: boolean;
  code: string;
} {
  if (!input.confirmed) return { allowed: false, code: "CONFIRMATION_REQUIRED" };
  if (!input.impactPreviewProvided) return { allowed: false, code: "IMPACT_PREVIEW_REQUIRED" };
  if (!input.reason || !String(input.reason).trim()) {
    return { allowed: false, code: "REASON_REQUIRED" };
  }
  return { allowed: true, code: "CONFIG_CHANGE_OK" };
}

export type BulkImportStage =
  | "UPLOAD"
  | "VALIDATE"
  | "PREVIEW"
  | "SHOW_ERRORS"
  | "CONFIRM"
  | "IMPORT"
  | "AUDIT";

export function nextBulkImportStage(current: BulkImportStage, hasErrors: boolean): BulkImportStage | null {
  // Branching stages handled explicitly
  if (current === "PREVIEW") return hasErrors ? "SHOW_ERRORS" : "CONFIRM";
  if (current === "SHOW_ERRORS") return hasErrors ? null : "CONFIRM";
  if (current === "CONFIRM") return hasErrors ? null : "IMPORT";

  // Linear progression for the remaining stages
  const linear: BulkImportStage[] = ["UPLOAD", "VALIDATE", "PREVIEW", "IMPORT", "AUDIT"];
  const idx = linear.indexOf(current);
  if (idx < 0) return null;
  return linear[idx + 1] ?? null;
}

export function canWriteBulkRows(stage: BulkImportStage, validated: boolean, confirmed: boolean): boolean {
  return stage === "IMPORT" && validated && confirmed;
}

/** Strip sensitive fields before returning to the client. */
export const SENSITIVE_CONFIG_FIELDS = new Set([
  "password",
  "passwordHash",
  "connectionString",
  "databaseUrl",
  "apiKey",
  "apiSecret",
  "secretKey",
  "token",
  "refreshToken",
  "resetToken",
  "smtpPassword",
  "smsApiKey",
  "jwtSecret"
]);

export function sanitizeSystemResponse<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !SENSITIVE_CONFIG_FIELDS.has(key))
  ) as Partial<T>;
}
