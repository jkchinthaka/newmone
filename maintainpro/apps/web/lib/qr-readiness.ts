export const QR_PAYLOAD_VERSION = 1 as const;

export const QR_ENTITY_TYPES = [
  "property",
  "building",
  "floor",
  "room",
  "asset",
  "work-order",
  "facility-issue"
] as const;

export type QrEntityType = (typeof QR_ENTITY_TYPES)[number];

export type MaintainProQrPayload = {
  v: typeof QR_PAYLOAD_VERSION;
  type: QrEntityType;
  tenantId?: string;
  entityId: string;
  label?: string;
  createdAt?: string;
};

const FORBIDDEN_QR_FIELDS = [
  "token",
  "accessToken",
  "refreshToken",
  "password",
  "secret",
  "apiKey",
  "invitationLink",
  "invitationToken",
  "sessionToken",
  "authorization",
  "jwt"
] as const;

const ENTITY_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export class QrPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QrPayloadError";
  }
}

function assertSafeIdentifier(value: string, fieldName: string, pattern: RegExp): void {
  if (!pattern.test(value)) {
    throw new QrPayloadError(`${fieldName} must be a safe identifier.`);
  }
}

function assertNoForbiddenFields(input: Record<string, unknown>): void {
  for (const key of Object.keys(input)) {
    const normalized = key.toLowerCase();
    if (FORBIDDEN_QR_FIELDS.some((field) => normalized.includes(field.toLowerCase()))) {
      throw new QrPayloadError(`Forbidden QR field detected: ${key}`);
    }
  }
}

export function isSupportedQrEntityType(value: unknown): value is QrEntityType {
  return typeof value === "string" && (QR_ENTITY_TYPES as readonly string[]).includes(value);
}

export function createMaintainProQrPayload(input: {
  type: QrEntityType;
  entityId: string;
  tenantId?: string;
  label?: string;
  createdAt?: string;
}): MaintainProQrPayload {
  assertNoForbiddenFields(input as unknown as Record<string, unknown>);
  assertSafeIdentifier(input.entityId, "entityId", ENTITY_ID_PATTERN);

  if (input.tenantId !== undefined) {
    assertSafeIdentifier(input.tenantId, "tenantId", TENANT_ID_PATTERN);
  }

  if (input.label !== undefined && input.label.trim().length === 0) {
    throw new QrPayloadError("label cannot be empty when provided.");
  }

  if (input.createdAt !== undefined && Number.isNaN(Date.parse(input.createdAt))) {
    throw new QrPayloadError("createdAt must be a valid ISO timestamp when provided.");
  }

  return {
    v: QR_PAYLOAD_VERSION,
    type: input.type,
    entityId: input.entityId,
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    ...(input.label ? { label: input.label.trim() } : {}),
    ...(input.createdAt ? { createdAt: input.createdAt } : {})
  };
}

export function encodeMaintainProQrPayload(payload: MaintainProQrPayload): string {
  const parsed = parseMaintainProQrPayload(JSON.stringify(payload));
  return JSON.stringify(parsed);
}

export function parseMaintainProQrPayload(raw: string): MaintainProQrPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new QrPayloadError("QR payload must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new QrPayloadError("QR payload must be a JSON object.");
  }

  const record = parsed as Record<string, unknown>;
  assertNoForbiddenFields(record);

  if (record.v !== QR_PAYLOAD_VERSION) {
    throw new QrPayloadError(`Unsupported QR payload version: ${String(record.v)}`);
  }

  if (!isSupportedQrEntityType(record.type)) {
    throw new QrPayloadError("Unsupported QR entity type.");
  }

  if (typeof record.entityId !== "string") {
    throw new QrPayloadError("entityId is required.");
  }

  assertSafeIdentifier(record.entityId, "entityId", ENTITY_ID_PATTERN);

  if (record.tenantId !== undefined) {
    if (typeof record.tenantId !== "string") {
      throw new QrPayloadError("tenantId must be a string when provided.");
    }

    assertSafeIdentifier(record.tenantId, "tenantId", TENANT_ID_PATTERN);
  }

  if (record.label !== undefined) {
    if (typeof record.label !== "string" || record.label.trim().length === 0) {
      throw new QrPayloadError("label must be a non-empty string when provided.");
    }
  }

  if (record.createdAt !== undefined) {
    if (typeof record.createdAt !== "string" || Number.isNaN(Date.parse(record.createdAt))) {
      throw new QrPayloadError("createdAt must be a valid ISO timestamp when provided.");
    }
  }

  return {
    v: QR_PAYLOAD_VERSION,
    type: record.type,
    entityId: record.entityId,
    ...(record.tenantId ? { tenantId: record.tenantId as string } : {}),
    ...(record.label ? { label: (record.label as string).trim() } : {}),
    ...(record.createdAt ? { createdAt: record.createdAt as string } : {})
  };
}

export function qrPayloadContainsForbiddenSecrets(payload: MaintainProQrPayload): boolean {
  try {
    assertNoForbiddenFields(payload as unknown as Record<string, unknown>);
    return false;
  } catch {
    return true;
  }
}
