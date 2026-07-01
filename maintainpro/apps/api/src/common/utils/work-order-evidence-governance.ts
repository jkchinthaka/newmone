import { BadRequestException } from "@nestjs/common";
import { EvidenceType, EvidenceVerificationStatus, QrVerificationStatus, WorkOrderType } from "@prisma/client";

/** Work order types requiring before/after photos + completion note before technician completion. */
export const EVIDENCE_REQUIRED_WORK_ORDER_TYPES = new Set<WorkOrderType>([
  WorkOrderType.CORRECTIVE,
  WorkOrderType.EMERGENCY,
  WorkOrderType.ACCIDENT_REPAIR,
  WorkOrderType.PREVENTIVE,
  WorkOrderType.INSPECTION,
  WorkOrderType.INSTALLATION
]);

export const QR_VERIFICATION_REQUIRED_TYPES = new Set<WorkOrderType>([
  WorkOrderType.CORRECTIVE,
  WorkOrderType.EMERGENCY,
  WorkOrderType.ACCIDENT_REPAIR
]);

export type EvidenceLineSnapshot = {
  evidenceType: EvidenceType;
  status: string;
  verificationStatus?: EvidenceVerificationStatus | null;
};

export function requiresTypedEvidence(type: WorkOrderType): boolean {
  return EVIDENCE_REQUIRED_WORK_ORDER_TYPES.has(type);
}

export function requiresQrVerification(type: WorkOrderType, assetId?: string | null, vehicleId?: string | null): boolean {
  if (!assetId && !vehicleId) return false;
  return QR_VERIFICATION_REQUIRED_TYPES.has(type);
}

export function isStorageUploadsEnabled(): boolean {
  return /^(1|true|yes)$/i.test((process.env.STORAGE_UPLOADS_ENABLED ?? "").trim());
}

export function evaluateEvidenceRequirements(
  workOrderType: WorkOrderType,
  items: EvidenceLineSnapshot[],
  options?: { storageEnabled?: boolean; includeRejected?: boolean }
) {
  const storageEnabled = options?.storageEnabled ?? isStorageUploadsEnabled();
  const active = items.filter((item) => item.status !== "DELETED" && item.status !== "FAILED");
  const accepted = active.filter(
    (item) =>
      item.status === "UPLOADED" &&
      (options?.includeRejected || item.verificationStatus !== EvidenceVerificationStatus.REJECTED)
  );

  const hasBefore = accepted.some((item) => item.evidenceType === EvidenceType.BEFORE_PHOTO);
  const hasAfter = accepted.some((item) => item.evidenceType === EvidenceType.AFTER_PHOTO);
  const required = requiresTypedEvidence(workOrderType);

  return {
    required,
    storageEnabled,
    hasBefore,
    hasAfter,
    beforeCount: accepted.filter((item) => item.evidenceType === EvidenceType.BEFORE_PHOTO).length,
    afterCount: accepted.filter((item) => item.evidenceType === EvidenceType.AFTER_PHOTO).length,
    missingBefore: required && storageEnabled && !hasBefore,
    missingAfter: required && storageEnabled && !hasAfter,
    complete: !required || !storageEnabled || (hasBefore && hasAfter),
    rejectedCount: active.filter((item) => item.verificationStatus === EvidenceVerificationStatus.REJECTED).length
  };
}

export function assertEvidenceForTechnicianCompletion(input: {
  workOrderType: WorkOrderType;
  items: EvidenceLineSnapshot[];
  completionNote?: string | null;
  qrStatus?: QrVerificationStatus | null;
  assetId?: string | null;
  vehicleId?: string | null;
  overrideReason?: string | null;
}) {
  if (!input.completionNote?.trim()) {
    throw new BadRequestException("Technician completion note is required.");
  }

  const checklist = evaluateEvidenceRequirements(input.workOrderType, input.items);
  if (checklist.required && checklist.storageEnabled) {
    if (checklist.missingBefore) {
      throw new BadRequestException("Before photo is required before completion.");
    }
    if (checklist.missingAfter) {
      throw new BadRequestException("After photo is required before completion.");
    }
  } else if (checklist.required && !checklist.storageEnabled && !input.overrideReason?.trim()) {
    throw new BadRequestException(
      "File upload storage is not configured. Required evidence cannot be captured — contact a manager for override."
    );
  }

  if (requiresQrVerification(input.workOrderType, input.assetId, input.vehicleId)) {
    const ok =
      input.qrStatus === QrVerificationStatus.VERIFIED || input.qrStatus === QrVerificationStatus.OVERRIDDEN;
    if (!ok && !input.overrideReason?.trim()) {
      throw new BadRequestException("QR verification required before completion.");
    }
  }

  if (checklist.rejectedCount > 0 && !input.overrideReason?.trim()) {
    throw new BadRequestException("Evidence was rejected. Rework or supervisor review is required before completion.");
  }
}

export function assertEvidenceForSupervisorVerification(input: {
  workOrderType: WorkOrderType;
  items: EvidenceLineSnapshot[];
  overrideReason?: string | null;
}) {
  const checklist = evaluateEvidenceRequirements(input.workOrderType, input.items, { storageEnabled: true });
  if ((!checklist.hasBefore || !checklist.hasAfter) && checklist.required && !input.overrideReason?.trim()) {
    throw new BadRequestException("Supervisor verification blocked because required evidence is missing.");
  }
  if (checklist.rejectedCount > 0 && !input.overrideReason?.trim()) {
    throw new BadRequestException("Supervisor verification blocked because evidence was rejected.");
  }
}
