export type EvidenceStorageReadiness = {
  providerId: string;
  mode: string;
  state: "disabled" | "not_configured" | "misconfigured" | "configured";
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
  uploadedByName: string | null;
  createdAt: string;
  downloadAvailable: boolean;
};

export type WorkOrderEvidenceListResponse = {
  workOrderId: string;
  items: WorkOrderEvidenceItem[];
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

const EVIDENCE_UPLOAD_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "ASSET_MANAGER",
  "MECHANIC",
  "TECHNICIAN",
  "FACILITY_MANAGER"
]);

export function canUploadWorkOrderEvidence(role?: string | null): boolean {
  if (!role) {
    return false;
  }

  return EVIDENCE_UPLOAD_ROLES.has(role);
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

export function evidencePayloadHasSecrets(value: unknown): boolean {
  if (!value) {
    return false;
  }

  const serialized = JSON.stringify(value);
  return /storagekey|storage_key|secret|token|presign|cloudinary|minio|access_key/i.test(serialized);
}

export function evidenceUploadDisabledMessage(readiness: EvidenceStorageReadiness | null | undefined): string {
  if (!readiness) {
    return "Evidence upload setup is unavailable.";
  }

  if (!readiness.uploadsEnabled) {
    return "Evidence uploads are disabled until STORAGE_UPLOADS_ENABLED is enabled on the server.";
  }

  return readiness.message;
}
