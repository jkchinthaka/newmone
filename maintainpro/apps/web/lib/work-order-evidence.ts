export type EvidenceStorageReadiness = {
  providerId: string;
  mode: string;
  state: "disabled" | "not_configured" | "misconfigured" | "configured";
  indicator?: string;
  uploadsEnabled: boolean;
  maxFileSizeMb: number;
  allowedMimeTypes: string[];
  message: string;
  missingKeys: string[];
};

export type WorkOrderEvidenceItem = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  evidenceType: string;
  verificationStatus: string;
  rejectedReason: string | null;
  note: string | null;
  isRequired: boolean;
  capturedAt: string | null;
  source: string;
  clientGeneratedId: string | null;
  offlineCreatedAt: string | null;
  syncedAt: string | null;
  syncStatus: string | null;
  syncError: string | null;
  uploadedByName: string | null;
  createdAt: string;
  downloadAvailable: boolean;
};

export type WorkOrderEvidenceRequirements = {
  required: boolean;
  storageEnabled: boolean;
  hasBefore: boolean;
  hasAfter: boolean;
  beforeCount: number;
  afterCount: number;
  missingBefore: boolean;
  missingAfter: boolean;
  complete: boolean;
  rejectedCount: number;
  completionNoteProvided: boolean;
  qrVerificationStatus: string;
  qrRequired: boolean;
};

export type WorkOrderEvidenceListResponse = {
  workOrderId: string;
  items: WorkOrderEvidenceItem[];
  requirements?: WorkOrderEvidenceRequirements;
  checkedAt: string;
};

export type EvidenceUploadRequestResult = {
  ok: boolean;
  status: string;
  mode: string;
  attachmentId?: string;
  uploadMethod?: "mock" | "presigned";
  uploadUrl?: string | null;
  expiresAt?: string | null;
  message: string;
};

export const EVIDENCE_TYPE_OPTIONS = [
  { value: "BEFORE_PHOTO", label: "Before photo" },
  { value: "AFTER_PHOTO", label: "After photo" },
  { value: "DAMAGE_PHOTO", label: "Damage photo" },
  { value: "PART_PHOTO", label: "Part photo" },
  { value: "INVOICE", label: "Invoice" },
  { value: "QUOTATION", label: "Quotation" },
  { value: "SIGNATURE", label: "Signature" },
  { value: "TECHNICIAN_NOTE", label: "Technician note" },
  { value: "OTHER_DOCUMENT", label: "Other document" }
] as const;

const EVIDENCE_UPLOAD_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "ASSET_MANAGER",
  "MECHANIC",
  "TECHNICIAN",
  "FACILITY_MANAGER",
  "MANAGER"
]);

const EVIDENCE_REVIEW_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "ASSET_MANAGER",
  "SUPERVISOR"
]);

export function canUploadWorkOrderEvidence(role?: string | null): boolean {
  if (!role) {
    return false;
  }

  return EVIDENCE_UPLOAD_ROLES.has(role.trim());
}

export function canReviewWorkOrderEvidence(role?: string | null): boolean {
  if (!role) return false;
  return EVIDENCE_REVIEW_ROLES.has(role);
}

export function isEvidenceUploadEnabled(readiness: EvidenceStorageReadiness | null | undefined): boolean {
  return readiness?.state === "configured" && readiness.uploadsEnabled === true;
}

export function formatAllowedEvidenceMimeTypes(mimeTypes: string[]): string {
  return mimeTypes
    .map((mime) => mime.replace("image/", "").replace("application/", "").toUpperCase())
    .join(", ");
}

export function formatEvidenceFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Field names that must never reach the browser in evidence payloads (storage internals, credentials). */
const SECRET_LIKE_EVIDENCE_KEY = /storage_?key|secret|token|presign|access_?key|password|credential|signature|cloudinary|minio/i;

/**
 * True when any field *name* in the payload looks like a leaked storage internal or credential.
 * Values are not inspected: provider ids ("minio"), missing env var names, file names and
 * technician notes legitimately contain these words.
 */
export function evidencePayloadHasSecrets(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => evidencePayloadHasSecrets(entry));
  }

  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) => SECRET_LIKE_EVIDENCE_KEY.test(key) || evidencePayloadHasSecrets(nested)
  );
}

export function evidenceUploadDisabledMessage(readiness: EvidenceStorageReadiness | null | undefined): string {
  if (!readiness) {
    return "Evidence upload setup is unavailable.";
  }

  if (!readiness.uploadsEnabled) {
    return "File upload storage is not configured. Enable STORAGE_UPLOADS_ENABLED on the server when ready.";
  }

  if (readiness.state !== "configured") {
    return readiness.message || "File upload storage is not configured.";
  }

  return readiness.message;
}

export function evidenceTypeLabel(type: string): string {
  return EVIDENCE_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type.replace(/_/g, " ");
}

export function verificationStatusLabel(status: string): string {
  switch (status) {
    case "ACCEPTED":
      return "Evidence accepted.";
    case "REJECTED":
      return "Evidence rejected. Rework required.";
    case "PENDING":
    default:
      return "Pending review";
  }
}
