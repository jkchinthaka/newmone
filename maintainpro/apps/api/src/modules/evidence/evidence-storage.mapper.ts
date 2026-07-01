import { randomUUID } from "node:crypto";

export const DEFAULT_EVIDENCE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
] as const;

export const DEFAULT_EVIDENCE_MAX_FILE_SIZE_MB = 10;

export type EvidenceStorageMode =
  | "disabled"
  | "mock"
  | "local"
  | "azure_blob"
  | "s3"
  | "r2"
  | "minio"
  | "cloudinary";

export type EvidenceStorageReadinessState =
  | "disabled"
  | "not_configured"
  | "misconfigured"
  | "configured";

export type EvidenceStorageIndicator = "ENABLED" | "DISABLED" | "MISCONFIGURED";

export type EvidenceStorageReadiness = {
  providerId: string;
  mode: EvidenceStorageMode;
  state: EvidenceStorageReadinessState;
  indicator: EvidenceStorageIndicator;
  uploadsEnabled: boolean;
  maxFileSizeMb: number;
  allowedMimeTypes: string[];
  message: string;
  missingKeys: string[];
};

export function mapEvidenceStorageIndicator(input: {
  state: EvidenceStorageReadinessState;
  uploadsEnabled: boolean;
}): EvidenceStorageIndicator {
  if (input.state === "configured" && input.uploadsEnabled) {
    return "ENABLED";
  }

  if (input.state === "misconfigured" || input.state === "not_configured") {
    return "MISCONFIGURED";
  }

  return "DISABLED";
}

export type EvidenceUploadValidationInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  maxFileSizeMb: number;
  allowedMimeTypes: string[];
};

export type EvidenceUploadValidationResult =
  | { ok: true; sanitizedFileName: string }
  | { ok: false; message: string };

export type EvidenceAttachmentPublic = {
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

export type EvidenceUploadRequestResult = {
  ok: boolean;
  status: "blocked" | "not_configured" | "misconfigured" | "ready";
  mode: string;
  attachmentId?: string;
  uploadMethod?: "mock" | "presigned";
  uploadUrl?: string | null;
  expiresAt?: string | null;
  message: string;
};

export type EvidenceConfirmUploadResult = {
  ok: boolean;
  status: "blocked" | "completed" | "failed";
  attachment?: EvidenceAttachmentPublic;
  message: string;
};

const PUBLIC_ATTACHMENT_KEYS = new Set<string>([
  "id",
  "fileName",
  "mimeType",
  "sizeBytes",
  "status",
  "evidenceType",
  "verificationStatus",
  "rejectedReason",
  "note",
  "isRequired",
  "capturedAt",
  "source",
  "clientGeneratedId",
  "offlineCreatedAt",
  "syncedAt",
  "syncStatus",
  "syncError",
  "uploadedByName",
  "createdAt",
  "downloadAvailable"
]);

const DANGEROUS_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".js",
  ".html",
  ".htm",
  ".svg",
  ".php",
  ".sh"
]);

export function parseAllowedMimeTypes(raw: string | undefined): string[] {
  const parsed = String(raw ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : [...DEFAULT_EVIDENCE_ALLOWED_MIME_TYPES];
}

export function sanitizeEvidenceFileName(fileName: string): string {
  const baseName = String(fileName ?? "")
    .replace(/[/\\]/g, "")
    .replace(/\.\.+/g, ".")
    .replace(/[^\w.\- ()[\]]+/g, "_")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 180);

  return baseName.length > 0 ? baseName : "evidence-file";
}

export function validateEvidenceUploadInput(
  input: EvidenceUploadValidationInput
): EvidenceUploadValidationResult {
  const sanitizedFileName = sanitizeEvidenceFileName(input.fileName);
  const extension = sanitizedFileName.includes(".")
    ? sanitizedFileName.slice(sanitizedFileName.lastIndexOf(".")).toLowerCase()
    : "";

  if (DANGEROUS_EXTENSIONS.has(extension)) {
    return { ok: false, message: "File extension is not allowed for evidence uploads." };
  }

  const mimeType = String(input.mimeType ?? "").trim().toLowerCase();
  if (!input.allowedMimeTypes.includes(mimeType)) {
    return { ok: false, message: `MIME type ${mimeType || "unknown"} is not allowed.` };
  }

  const sizeBytes = Number(input.sizeBytes);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, message: "File size must be greater than zero." };
  }

  const maxBytes = input.maxFileSizeMb * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return {
      ok: false,
      message: `File exceeds maximum allowed size of ${input.maxFileSizeMb} MB.`
    };
  }

  return { ok: true, sanitizedFileName };
}

export function buildEvidenceStorageKey(input: {
  tenantId: string | null;
  workOrderId: string;
  fileName: string;
}): string {
  const tenantSegment = input.tenantId ?? "global";
  return `evidence/${tenantSegment}/${input.workOrderId}/${randomUUID()}/${input.fileName}`;
}

export function mapEvidenceAttachmentPublic(input: {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  evidenceType?: string;
  verificationStatus?: string;
  rejectedReason?: string | null;
  note?: string | null;
  isRequired?: boolean;
  capturedAt?: Date | null;
  source?: string;
  clientGeneratedId?: string | null;
  offlineCreatedAt?: Date | null;
  syncedAt?: Date | null;
  syncStatus?: string | null;
  syncError?: string | null;
  createdAt: Date;
  uploadedBy?: { firstName: string; lastName: string } | null;
  downloadAvailable?: boolean;
}): EvidenceAttachmentPublic {
  const uploadedByName = input.uploadedBy
    ? `${input.uploadedBy.firstName} ${input.uploadedBy.lastName}`.trim()
    : null;

  return {
    id: input.id,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    status: input.status,
    evidenceType: input.evidenceType ?? "OTHER_DOCUMENT",
    verificationStatus: input.verificationStatus ?? "PENDING",
    rejectedReason: input.rejectedReason ?? null,
    note: input.note ?? null,
    isRequired: Boolean(input.isRequired),
    capturedAt: input.capturedAt?.toISOString() ?? null,
    source: input.source ?? "WEB",
    clientGeneratedId: input.clientGeneratedId ?? null,
    offlineCreatedAt: input.offlineCreatedAt?.toISOString() ?? null,
    syncedAt: input.syncedAt?.toISOString() ?? null,
    syncStatus: input.syncStatus ?? null,
    syncError: input.syncError ?? null,
    uploadedByName,
    createdAt: input.createdAt.toISOString(),
    downloadAvailable: Boolean(input.downloadAvailable)
  };
}

export function publicEvidenceAttachmentHasSensitiveFields(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !PUBLIC_ATTACHMENT_KEYS.has(key))) {
    return true;
  }

  const serialized = JSON.stringify(record);
  return /storagekey|storage_key|secret|token|presign|cloudinary|minio|access_key/i.test(serialized);
}

const PUBLIC_READINESS_KEYS = new Set<string>([
  "providerId",
  "mode",
  "state",
  "indicator",
  "uploadsEnabled",
  "maxFileSizeMb",
  "allowedMimeTypes",
  "message",
  "missingKeys"
]);

export function publicEvidenceReadinessHasSensitiveFields(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !PUBLIC_READINESS_KEYS.has(key))) {
    return true;
  }

  const serialized = JSON.stringify(record);
  return /secret-value|bearer\s+[a-z0-9+/=]{8,}|minioadmin/i.test(serialized);
}
