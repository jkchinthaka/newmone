import { Prisma, PrismaClient, ReplicationOperation } from "@prisma/client";

import { redactSensitiveData, REDACTED_PLACEHOLDER } from "../common/utils/sensitive-data-redaction.util";
import {
  getReplicationClass,
  REPLICATION_METADATA_FIELDS,
  REPLICATION_REDACT_FIELDS,
  ReplicationClass,
  shouldEnqueueReplication
} from "./replication-classification";

export const REPLICATION_INTERNAL_MODELS = new Set<string>(["ReplicationOutbox"]);
export { shouldEnqueueReplication, getReplicationClass, ReplicationClass };

type PrismaDelegate = {
  findUnique?: (args: Record<string, unknown>) => Promise<unknown>;
  findMany?: (args?: Record<string, unknown>) => Promise<unknown[]>;
  upsert?: (args: Record<string, unknown>) => Promise<unknown>;
  update?: (args: Record<string, unknown>) => Promise<unknown>;
  delete?: (args: Record<string, unknown>) => Promise<unknown>;
  count?: (args?: Record<string, unknown>) => Promise<number>;
};

const modelByName = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));

export const SYNCABLE_MODEL_NAMES = Prisma.dmmf.datamodel.models
  .map((model) => model.name)
  .filter((modelName) => !REPLICATION_INTERNAL_MODELS.has(modelName));

export const VERIFICATION_MODEL_NAMES = [
  "Tenant",
  "User",
  "Role",
  "Permission",
  "Vehicle",
  "Driver",
  "WorkOrder",
  "VehicleGateMovement",
  "VehicleMeterLog",
  "VehicleDocument",
  "AccidentReport",
  "TrafficFine",
  "SparePart",
  "StockMovement",
  "PurchaseOrder",
  "PurchaseOrderLine",
  "PurchaseOrderApproval",
  "PurchaseOrderErpSync",
  "Supplier",
  "Notification"
].filter((modelName) => modelByName.has(modelName));

export function camelCase(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

export function getDelegate(client: PrismaClient, modelName: string): PrismaDelegate | null {
  const delegate = (client as unknown as Record<string, unknown>)[camelCase(modelName)];
  if (!delegate || typeof delegate !== "object") return null;
  return delegate as PrismaDelegate;
}

export function isSyncableModel(modelName: string): boolean {
  return (
    modelByName.has(modelName) &&
    !REPLICATION_INTERNAL_MODELS.has(modelName) &&
    shouldEnqueueReplication(modelName)
  );
}

function scalarFieldNames(modelName: string): Set<string> {
  const model = modelByName.get(modelName);
  if (!model) return new Set<string>();

  return new Set(
    model.fields
      .filter((field) => field.kind === "scalar" || field.kind === "enum")
      .map((field) => field.name)
  );
}

function dateFieldNames(modelName: string): Set<string> {
  const model = modelByName.get(modelName);
  if (!model) return new Set<string>();

  return new Set(
    model.fields
      .filter((field) => field.kind === "scalar" && field.type === "DateTime")
      .map((field) => field.name)
  );
}

export function sanitizeRecordForModel(modelName: string, value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const classification = getReplicationClass(modelName);
  if (classification === ReplicationClass.NEVER_REPLICATE) {
    return null;
  }

  const allowed = scalarFieldNames(modelName);
  if (allowed.size === 0) return null;

  let sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (allowed.has(key) && nestedValue !== undefined) {
      sanitized[key] = nestedValue;
    }
  }

  if (typeof sanitized.id !== "string") {
    return null;
  }

  if (classification === ReplicationClass.METADATA_ONLY) {
    const metaAllow = new Set(REPLICATION_METADATA_FIELDS[modelName] ?? ["id"]);
    sanitized = Object.fromEntries(
      Object.entries(sanitized).filter(([key]) => metaAllow.has(key))
    );
    if (typeof sanitized.id !== "string") {
      return null;
    }
    return sanitized;
  }

  if (
    classification === ReplicationClass.REPLICABLE_WITH_REDACTION ||
    classification === ReplicationClass.FULLY_REPLICABLE
  ) {
    const redactFields = REPLICATION_REDACT_FIELDS[modelName] ?? [];
    for (const field of redactFields) {
      if (field in sanitized) {
        // Omit credential material from the outbox wire; do not send plaintext or placeholder
        // that could overwrite a valid backup hash on apply.
        delete sanitized[field];
      }
    }
    sanitized = redactSensitiveData(sanitized, { omit: true }) as Record<string, unknown>;
  }

  return typeof sanitized.id === "string" ? sanitized : null;
}

/** Drop redacted/missing credential fields so backup upserts do not clobber usable hashes. */
export function stripUnavailableCredentialFields(
  modelName: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...payload };
  const redactFields = REPLICATION_REDACT_FIELDS[modelName] ?? [];
  for (const field of redactFields) {
    if (!(field in next) || next[field] === REDACTED_PLACEHOLDER) {
      delete next[field];
    }
  }
  return next;
}

export function toOutboxJson(value: unknown): Prisma.InputJsonValue | undefined {
  const normalized = normalizeJson(value);
  if (normalized === undefined) return undefined;
  return normalized as Prisma.InputJsonValue;
}

function normalizeJson(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value)) return value.map((entry) => normalizeJson(entry));
  if (typeof value === "object") {
    const normalized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const nested = normalizeJson(nestedValue);
      if (nested !== undefined) normalized[key] = nested;
    }
    return normalized;
  }
  return value;
}

export function fromOutboxJson(modelName: string, payload: unknown): Record<string, unknown> | null {
  const sanitized = sanitizeRecordForModel(modelName, payload);
  if (!sanitized) return null;

  const dateFields = dateFieldNames(modelName);
  for (const fieldName of dateFields) {
    const value = sanitized[fieldName];
    if (typeof value === "string") {
      sanitized[fieldName] = new Date(value);
    }
  }

  return sanitized;
}

export async function applyReplicationEventToBackup(
  backup: PrismaClient,
  event: {
    modelName: string;
    entityId: string;
    operation: ReplicationOperation;
    payload?: Prisma.JsonValue | null;
  }
): Promise<void> {
  if (!isSyncableModel(event.modelName)) {
    return;
  }

  const delegate = getDelegate(backup, event.modelName);
  if (!delegate) {
    throw new Error(`No Prisma delegate found for model ${event.modelName}`);
  }

  if (event.operation === ReplicationOperation.DELETE) {
    if (!delegate.delete) throw new Error(`Model ${event.modelName} does not support delete`);
    try {
      await delegate.delete({ where: { id: event.entityId } });
    } catch (error) {
      if (isNotFoundError(error)) return;
      throw error;
    }
    return;
  }

  if (!delegate.upsert) {
    throw new Error(`Model ${event.modelName} does not support upsert`);
  }

  const payload = fromOutboxJson(event.modelName, event.payload ?? null);
  if (!payload) {
    throw new Error(`Replication payload is missing for ${event.modelName}:${event.entityId}`);
  }

  const safePayload = stripUnavailableCredentialFields(event.modelName, payload);
  const updatePayload = { ...safePayload };
  delete updatePayload.id;

  if (event.modelName === "User" && typeof safePayload.passwordHash !== "string") {
    if (!delegate.findUnique || !delegate.update) {
      throw new Error(`Model ${event.modelName} does not support credential-safe update`);
    }
    const existing = await delegate.findUnique({ where: { id: event.entityId } });
    if (!existing) {
      return;
    }
    await delegate.update({
      where: { id: event.entityId },
      data: updatePayload
    });
    return;
  }

  await delegate.upsert({
    where: { id: event.entityId },
    create: safePayload,
    update: updatePayload
  });
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
  );
}