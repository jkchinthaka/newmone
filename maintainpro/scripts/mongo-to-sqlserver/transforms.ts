/**
 * Phase 15A — deterministic Mongo → SQL field transforms.
 * Pure functions; safe to unit-test without DB.
 */
import { Prisma } from "@prisma/client";

export type JsonPrimitive = string | number | boolean | null;

/** BSON ObjectId-like → 24-char hex string. Leaves other values alone. */
export function objectIdToString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const anyVal = value as { _bsontype?: string; toHexString?: () => string; toString?: () => string; $oid?: string };
    if (typeof anyVal.$oid === "string") return anyVal.$oid;
    if (typeof anyVal.toHexString === "function") return anyVal.toHexString();
    if (anyVal._bsontype === "ObjectId" && typeof anyVal.toString === "function") {
      const s = anyVal.toString();
      if (/^[a-fA-F0-9]{24}$/.test(s)) return s;
    }
    // Buffer-backed ObjectId
    if (Buffer.isBuffer(value) && value.length === 12) return value.toString("hex");
  }
  return String(value);
}

const ID_KEY_HINT =
  /^(id|_id|.*Id|.*Ids|tenantId|userId|roleId|assetId|siteId|functionalLocationId|parentId|workOrderId|requestId|vendorId|permissionId|departmentId|domainId|vehicleId|driverId|warehouseId|partId|supplierId|pmPlanId|meterId)$/i;

export function convertObjectIdsDeep(value: unknown, keyHint?: string): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    if (keyHint && /Ids$/i.test(keyHint)) {
      return value.map((v) => objectIdToString(v));
    }
    return value.map((v) => convertObjectIdsDeep(v));
  }
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const anyVal = value as { _bsontype?: string; toHexString?: () => string; $oid?: string };
    if (anyVal.$oid || anyVal._bsontype === "ObjectId" || typeof anyVal.toHexString === "function") {
      return objectIdToString(value);
    }
    if (Buffer.isBuffer(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (ID_KEY_HINT.test(k) && !Array.isArray(v) && v !== null && typeof v === "object") {
        out[k] = objectIdToString(v);
      } else if (ID_KEY_HINT.test(k) && Array.isArray(v)) {
        out[k] = v.map((item) => objectIdToString(item));
      } else {
        out[k] = convertObjectIdsDeep(v, k);
      }
    }
    return out;
  }
  return value;
}

/** Preserve Date instances; coerce BSON Date / ISO strings. Never JSON-stringify dates. */
export function coerceDate(value: unknown): Date | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && (value as { _bsontype?: string })._bsontype === "Date") {
    return new Date(value as unknown as string);
  }
  if (typeof value === "object" && value !== null && "$date" in (value as object)) {
    return new Date((value as { $date: string | number }).$date);
  }
  if (typeof value === "number" || typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  throw new Error(`Invalid date value: ${String(value)}`);
}

const DATE_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "dueAt",
  "dueDate",
  "reportedAt",
  "completedAt",
  "verifiedAt",
  "closedAt",
  "startedAt",
  "endedAt",
  "heldAt",
  "resumedAt",
  "approvedAt",
  "rejectedAt",
  "expiresAt",
  "expiryDate",
  "nextDueAt",
  "lastReadingAt",
  "readingAt",
  "occurredAt",
  "effectiveFrom",
  "effectiveTo",
  "startDate",
  "endDate",
  "warrantyExpiry",
  "purchaseDate",
  "lastServiceDate",
  "nextServiceDate",
  "syncedAt",
  "revokedAt",
  "lastUsedAt",
  "usedAt",
  "lockedUntil",
  "temporaryPasswordExpiresAt",
  "lastPasswordChangedAt",
  "lastLogin",
  "acceptedAt"
]);

export function coerceDatesDeep(value: unknown, keyHint?: string): unknown {
  if (value === null || value === undefined) return value;
  if (keyHint && DATE_KEYS.has(keyHint)) return coerceDate(value);
  if (Array.isArray(value)) return value.map((v) => coerceDatesDeep(v));
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const anyVal = value as { _bsontype?: string };
    if (anyVal._bsontype === "ObjectId") return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = coerceDatesDeep(v, k);
    }
    return out;
  }
  return value;
}

export function toDecimal(value: unknown): Prisma.Decimal | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === "number" || typeof value === "string") {
    return new Prisma.Decimal(value);
  }
  if (typeof value === "object" && value !== null && "toString" in value) {
    return new Prisma.Decimal(String((value as { toString: () => string }).toString()));
  }
  throw new Error(`Invalid decimal: ${String(value)}`);
}

const DECIMAL_KEYS = new Set([
  "partsCost",
  "internalLabourCost",
  "externalServiceCost",
  "transportCost",
  "otherCost",
  "totalCost",
  "estimatedCost",
  "actualCost",
  "labourRateSnapshot",
  "unitCost",
  "amountThreshold",
  "totalAmount",
  "invoiceAmount",
  "taxAmount",
  "costPerLiter",
  "cost",
  "unitCostSnapshot",
  "purchasePrice"
]);

export function coerceDecimalsDeep(value: unknown, keyHint?: string): unknown {
  if (value === null || value === undefined) return value;
  if (keyHint && DECIMAL_KEYS.has(keyHint)) return toDecimal(value);
  if (Array.isArray(value)) return value.map((v) => coerceDecimalsDeep(v));
  if (typeof value === "object" && !(value instanceof Date) && !(value instanceof Prisma.Decimal)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = coerceDecimalsDeep(v, k);
    }
    return out;
  }
  return value;
}

export function toJsonText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    JSON.parse(value); // validate
    return value;
  }
  return JSON.stringify(value);
}

export function stringArrayToJsonText(value: unknown): string {
  if (value === null || value === undefined) return "[]";
  if (typeof value === "string") {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error("Expected JSON array string");
    return JSON.stringify(parsed);
  }
  if (!Array.isArray(value)) throw new Error("Expected array for string-array field");
  return JSON.stringify(value.map((v) => (v == null ? v : String(objectIdToString(v) ?? v))));
}

/** Known Mongo scalar-list fields retained as NVARCHAR JSON text (not junctions). */
export const JSON_TEXT_ARRAY_FIELDS = new Set([
  "images",
  "documents",
  "attachments",
  "photos",
  "evidenceUrls",
  "documentUrls",
  "beforePhotos",
  "afterPhotos",
  "ppeRequired",
  "workCategories",
  "skillTags",
  "requiredSkills",
  "allowedRoles",
  "aliases",
  "keywords",
  "commonMistakes",
  "sinhalaKeywords",
  "departmentHints",
  "serviceCategories",
  "certifications",
  "reasonCodes",
  "priorityScope",
  "workTypeScope",
  "linkedChangeRequests",
  "linkedQaIssues",
  "linkedTickets",
  "options"
]);

export const JSON_OBJECT_FIELDS = new Set([
  "metadata",
  "metadataSafe",
  "payload",
  "actorSnapshot",
  "beforeData",
  "afterData",
  "resultJson",
  "raw",
  "value",
  "customAttributes",
  "customFields",
  "profile",
  "conditions",
  "answers",
  "lineItems",
  "handoverChecklist",
  "mappingSnapshot",
  "stagingRecords",
  "sheetsDetected",
  "warehousesDetected",
  "normalizedData",
  "rawData",
  "errors",
  "warnings",
  "requestPayload",
  "responsePayload",
  "contextSnapshot",
  "criteriaSnapshot",
  "ruleSnapshot",
  "sourceContext",
  "templateSnapshot",
  "triggerSummary",
  "dryRunSummary",
  "applySummary",
  "sourceMetadata",
  "entityTypes",
  "summary",
  "shortageParts",
  "selectedUsers",
  "selectedRoles",
  "selectedModules",
  "blockers",
  "attachmentMetadata",
  "actions",
  "reasons",
  "factors",
  "items",
  "checklistItems",
  "dailyChecklist",
  "gpsPolygon",
  "skills" // Employee.skills as JSON text (User.skills → junction)
]);

export function applyJsonTextFields(doc: Record<string, unknown>): Record<string, unknown> {
  const out = { ...doc };
  for (const key of Object.keys(out)) {
    if (JSON_TEXT_ARRAY_FIELDS.has(key) && out[key] !== undefined) {
      out[key] = stringArrayToJsonText(out[key]);
    } else if (JSON_OBJECT_FIELDS.has(key) && out[key] !== undefined && out[key] !== null) {
      out[key] = toJsonText(out[key]);
    }
  }
  return out;
}

export function transformDocument(raw: Record<string, unknown>): Record<string, unknown> {
  let doc = convertObjectIdsDeep(raw) as Record<string, unknown>;
  doc = coerceDatesDeep(doc) as Record<string, unknown>;
  doc = coerceDecimalsDeep(doc) as Record<string, unknown>;
  // Normalize id from _id
  if (doc._id !== undefined && doc.id === undefined) {
    doc.id = objectIdToString(doc._id);
  } else if (doc.id !== undefined) {
    doc.id = objectIdToString(doc.id);
  }
  delete doc._id;
  doc = applyJsonTextFields(doc);
  return doc;
}
