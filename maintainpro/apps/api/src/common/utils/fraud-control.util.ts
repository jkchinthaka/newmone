import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

export const FRAUD_CONTROL_ENABLED = !/^(0|false|no)$/i.test(
  (process.env.FRAUD_CONTROL_ENABLED ?? "true").trim()
);

export const ADMIN_OVERRIDE_ROLES = new Set<RoleName>([
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
  RoleName.MANAGER,
  RoleName.OPERATIONS_MANAGER,
  RoleName.ASSET_MANAGER
]);

export const FRAUD_AUDIT_EVENTS = {
  PARTS_ISSUE_BLOCKED_NO_WORK_ORDER: "parts_issue_blocked_no_work_order",
  PARTS_ISSUED_AGAINST_WORK_ORDER: "parts_issued_against_work_order",
  PARTS_ISSUE_OVERRIDE: "parts_issue_override",
  DUPLICATE_PART_REQUEST_BLOCKED: "duplicate_part_request_blocked",
  NEGATIVE_STOCK_BLOCKED: "negative_stock_blocked",
  TECHNICIAN_SELF_ISSUE_BLOCKED: "technician_self_issue_blocked",
  COMPLETION_BLOCKED_MISSING_EVIDENCE: "completion_blocked_missing_evidence",
  COMPLETION_OVERRIDE_MISSING_EVIDENCE: "completion_override_missing_evidence",
  CLOSURE_BLOCKED_MISSING_VERIFICATION: "closure_blocked_missing_verification",
  MAKER_CHECKER_VIOLATION_BLOCKED: "maker_checker_violation_blocked",
  GATE_OUT_BLOCKED: "gate_out_blocked",
  GATE_OUT_OVERRIDE: "gate_out_override",
  INVOICE_APPROVAL_BLOCKED_UNVERIFIED: "invoice_approval_blocked_unverified_work_order",
  DUPLICATE_INVOICE_BLOCKED: "duplicate_invoice_blocked"
} as const;

export function assertReasonProvided(label: string, reason?: string | null) {
  const trimmed = reason?.trim();
  if (!trimmed || trimmed.length < 3) {
    throw new BadRequestException(`${label} is required (minimum 3 characters).`);
  }
}

export function isAdminRole(role?: RoleName | string | null): boolean {
  return role === RoleName.SUPER_ADMIN || role === RoleName.ADMIN;
}

export function assertMakerCheckerSeparation(input: {
  requesterId: string;
  approverId: string;
  approverRole?: RoleName | string | null;
  flow: string;
}) {
  if (!FRAUD_CONTROL_ENABLED) {
    return;
  }

  if (input.requesterId !== input.approverId) {
    return;
  }

  if (isAdminRole(input.approverRole as RoleName)) {
    return;
  }

  throw new ForbiddenException(
    `Maker-checker violation: the same user cannot request and approve this ${input.flow} transaction.`
  );
}

export function metadataIndicatesOverride(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }

  const record = metadata as Record<string, unknown>;
  if (record.overrideFlag === true) {
    return true;
  }

  const event = typeof record.event === "string" ? record.event : "";
  return /override|maker_checker/i.test(event);
}
