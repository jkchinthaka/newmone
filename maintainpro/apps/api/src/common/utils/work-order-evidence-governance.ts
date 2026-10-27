import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { EvidenceType, EvidenceVerificationStatus, QrVerificationStatus, WorkOrderType } from "@prisma/client";

import { EvidenceStorageProviderService } from "../../modules/evidence/evidence-storage-provider.service";

/**
 * Single list of work order types requiring before/after photos. Used at technician completion,
 * supervisor verification, emergency close and close (work-order-governance re-exports it).
 */
export const EVIDENCE_REQUIRED_WORK_ORDER_TYPES = new Set<WorkOrderType>([
  WorkOrderType.CORRECTIVE,
  WorkOrderType.EMERGENCY,
  WorkOrderType.ACCIDENT_REPAIR,
  WorkOrderType.PREVENTIVE,
  WorkOrderType.INSPECTION,
  WorkOrderType.INSTALLATION,
  WorkOrderType.BREAKDOWN,
  WorkOrderType.INSPECTION_CORRECTIVE
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

const STORAGE_ENV_KEYS = [
  "NODE_ENV",
  "STORAGE_MODE",
  "STORAGE_UPLOADS_ENABLED",
  "STORAGE_LOCAL_PRODUCTION",
  "STORAGE_LOCAL_ROOT",
  "STORAGE_MAX_FILE_SIZE_MB",
  "STORAGE_ALLOWED_MIME_TYPES",
  "ALLOW_MOCK_IN_PRODUCTION",
  "MINIO_ENDPOINT",
  "MINIO_ACCESS_KEY",
  "MINIO_SECRET_KEY",
  "MINIO_BUCKET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET"
] as const;
const BOOLEAN_STORAGE_KEYS = new Set(["STORAGE_UPLOADS_ENABLED", "STORAGE_LOCAL_PRODUCTION", "ALLOW_MOCK_IN_PRODUCTION"]);
const READINESS_CACHE_MS = 30_000;
let readinessCache: { key: string; at: number; enabled: boolean } | null = null;

/** process.env view typed the way the Joi-validated ConfigService returns it. */
function envConfig(): ConfigService {
  return {
    get: (key: string, fallback?: unknown) => {
      const raw = process.env[key];
      if (raw === undefined || raw === "") return fallback;
      if (BOOLEAN_STORAGE_KEYS.has(key)) return /^(1|true|yes)$/i.test(raw.trim());
      return raw;
    }
  } as unknown as ConfigService;
}

/**
 * Uploads count as enabled only when the evidence storage provider reports `configured`, so
 * completion rules never demand photos the provider would refuse to store (or waive photos it
 * can store). Cached briefly because production readiness probes the disk.
 */
export function isStorageUploadsEnabled(): boolean {
  const key = STORAGE_ENV_KEYS.map((name) => process.env[name] ?? "").join("\u0000");
  const now = Date.now();
  if (readinessCache && readinessCache.key === key && now - readinessCache.at < READINESS_CACHE_MS) {
    return readinessCache.enabled;
  }
  const readiness = new EvidenceStorageProviderService(envConfig()).checkReadiness();
  const enabled = readiness.state === "configured" && readiness.uploadsEnabled;
  readinessCache = { key, at: now, enabled };
  return enabled;
}

export function evaluateEvidenceRequirements(
  workOrderType: WorkOrderType,
  items: EvidenceLineSnapshot[],
  options?: { storageEnabled?: boolean; includeRejected?: boolean; overrideReason?: string | null }
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

  const isProduction = String(process.env.NODE_ENV ?? "").toLowerCase() === "production";
  // Fail closed in production: required evidence cannot be waived when storage is unavailable.
  // Non-production may proceed with completion note only when storage is explicitly disabled.
  // An authorized override (caller checks canOverrideCompletionBlock) lifts the storage block.
  const storageOverridden = Boolean(options?.overrideReason?.trim());
  const storageBlocksCompletion = required && !storageEnabled && isProduction && !storageOverridden;
  const photoComplete = hasBefore && hasAfter;
  const waived = required && !storageEnabled && (!isProduction || storageOverridden);
  const evidenceSatisfied = storageEnabled ? photoComplete : waived;
  const complete = required && evidenceSatisfied && !storageBlocksCompletion;

  return {
    required,
    storageEnabled,
    waived,
    hasBefore,
    hasAfter,
    beforeCount: accepted.filter((item) => item.evidenceType === EvidenceType.BEFORE_PHOTO).length,
    afterCount: accepted.filter((item) => item.evidenceType === EvidenceType.AFTER_PHOTO).length,
    missingBefore: required && storageEnabled && !waived && !hasBefore,
    missingAfter: required && storageEnabled && !waived && !hasAfter,
    storageUnavailableBlocking: storageBlocksCompletion,
    complete,
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

  const checklist = evaluateEvidenceRequirements(input.workOrderType, input.items, {
    overrideReason: input.overrideReason
  });
  if (checklist.storageUnavailableBlocking) {
    throw new BadRequestException(
      "Evidence storage is unavailable. Completion is blocked while required photo evidence cannot be stored (fail closed)."
    );
  }
  if (checklist.required && checklist.storageEnabled) {
    if (checklist.missingBefore) {
      throw new BadRequestException("Before photo is required before completion.");
    }
    if (checklist.missingAfter) {
      throw new BadRequestException("After photo is required before completion.");
    }
  }

  if (requiresQrVerification(input.workOrderType, input.assetId, input.vehicleId)) {
    const isProduction = String(process.env.NODE_ENV ?? "").toLowerCase() === "production";
    const e2eMode = /^(1|true|yes)$/i.test((process.env.E2E_TEST_MODE ?? "").trim());
    // E2E_TEST_MODE must never waive QR in production (boot also refuses this combo).
    const allowE2eBypass = e2eMode && !isProduction;
    const ok =
      input.qrStatus === QrVerificationStatus.VERIFIED ||
      input.qrStatus === QrVerificationStatus.OVERRIDDEN ||
      allowE2eBypass;
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
  const checklist = evaluateEvidenceRequirements(input.workOrderType, input.items);
  if (checklist.storageUnavailableBlocking && !input.overrideReason?.trim()) {
    throw new BadRequestException(
      "Evidence storage is unavailable. Supervisor verification is blocked while required photo evidence cannot be stored."
    );
  }
  if (
    checklist.required &&
    checklist.storageEnabled &&
    (!checklist.hasBefore || !checklist.hasAfter) &&
    !input.overrideReason?.trim()
  ) {
    throw new BadRequestException("Supervisor verification blocked because required evidence is missing.");
  }
  if (checklist.rejectedCount > 0 && !input.overrideReason?.trim()) {
    throw new BadRequestException("Supervisor verification blocked because evidence was rejected.");
  }
}
