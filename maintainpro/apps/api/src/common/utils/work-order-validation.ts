import { BadRequestException } from "@nestjs/common";
import { WorkOrderType } from "@prisma/client";

/** Work order types that must link to an asset or vehicle (machine-specific maintenance). */
export const ASSET_OR_VEHICLE_REQUIRED_TYPES = new Set<WorkOrderType>([
  WorkOrderType.PREVENTIVE,
  WorkOrderType.INSPECTION,
  WorkOrderType.INSTALLATION,
  WorkOrderType.ACCIDENT_REPAIR
]);

/** Accept Prisma cuid / UUID-style ids (SQL Server NVarChar(36)). Legacy Mongo ObjectIds still pass. */
const ENTITY_ID_PATTERN = /^(?:[a-fA-F0-9]{24}|[a-zA-Z0-9_-]{8,64})$/;

export function normalizeOptionalObjectId(value?: string | null): string | undefined {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function assertValidOptionalObjectId(field: string, value?: string | null) {
  const normalized = normalizeOptionalObjectId(value);
  if (!normalized) {
    return undefined;
  }

  if (!ENTITY_ID_PATTERN.test(normalized)) {
    throw new BadRequestException(
      `Invalid ${field}: "${normalized}". Expected a stable entity id (cuid/UUID/legacy ObjectId), or leave the field empty.`
    );
  }

  return normalized;
}

export function assertValidEntityId(field: string, value?: string | null): string {
  const normalized = normalizeOptionalObjectId(value);
  if (!normalized) {
    throw new BadRequestException(`${field} is required`);
  }
  if (!ENTITY_ID_PATTERN.test(normalized)) {
    throw new BadRequestException(
      `Invalid ${field}. Please log in again to refresh your session.`
    );
  }
  return normalized;
}

export function assertWorkOrderAssetRules(input: {
  type: WorkOrderType;
  assetId?: string | null;
  vehicleId?: string | null;
  functionalLocationId?: string | null;
}) {
  const assetId = normalizeOptionalObjectId(input.assetId);
  const vehicleId = normalizeOptionalObjectId(input.vehicleId);
  const functionalLocationId = normalizeOptionalObjectId(input.functionalLocationId);

  if (ASSET_OR_VEHICLE_REQUIRED_TYPES.has(input.type) && !assetId && !vehicleId) {
    throw new BadRequestException(
      `Work order type ${input.type} requires an asset or vehicle link. Location-only is not sufficient for this type.`
    );
  }

  // Phase 6: at least one of asset, vehicle, or functional location for all WOs
  if (!assetId && !vehicleId && !functionalLocationId) {
    throw new BadRequestException(
      "Work order requires an asset, vehicle, or functional location (at least one)."
    );
  }

  return { assetId, vehicleId, functionalLocationId };
}

export type SlaRiskLevel = "OVERDUE" | "DUE_24H" | "DUE_3D" | "FUTURE" | "NONE";

export function calculateSlaRisk(input: {
  dueDate?: Date | null;
  expectedCompletionDate?: Date | null;
  plannedEndAt?: Date | null;
  status?: string;
  now?: Date;
}): { level: SlaRiskLevel; delayDays: number; targetDate: Date | null } {
  const now = input.now ?? new Date();
  if (input.status === "COMPLETED" || input.status === "CANCELLED" || input.status === "CLOSED" || input.status === "VERIFIED") {
    return { level: "NONE", delayDays: 0, targetDate: null };
  }

  const target =
    input.plannedEndAt ?? input.expectedCompletionDate ?? input.dueDate ?? null;
  if (!target) {
    return { level: "NONE", delayDays: 0, targetDate: null };
  }

  const ms = target.getTime() - now.getTime();
  const delayDays = ms < 0 ? Math.ceil(Math.abs(ms) / (24 * 60 * 60 * 1000)) : 0;

  if (ms < 0) {
    return { level: "OVERDUE", delayDays, targetDate: target };
  }

  const hours = ms / (60 * 60 * 1000);
  if (hours <= 24) {
    return { level: "DUE_24H", delayDays: 0, targetDate: target };
  }

  const days = ms / (24 * 60 * 60 * 1000);
  if (days <= 3) {
    return { level: "DUE_3D", delayDays: 0, targetDate: target };
  }

  return { level: "FUTURE", delayDays: 0, targetDate: target };
}

export function parseWorkOrderDateField(field: string, value?: string | null): Date | undefined {
  if (value === undefined || value === null || String(value).trim() === "") {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} is not a valid date.`);
  }

  return parsed;
}

function utcDayStartMs(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function assertNotEarlier(laterLabel: string, later: Date | null | undefined, earlierLabel: string, earlier: Date | null | undefined) {
  if (later && earlier && later.getTime() < earlier.getTime()) {
    throw new BadRequestException(`${laterLabel} must not be earlier than ${earlierLabel}`);
  }
}

/**
 * Validates work-order schedule field combinations.
 * - Sequence rules always apply when both sides of a pair are present.
 * - Equal dates are allowed.
 * - When `rejectPastDates` is true (create), due / expected / planned start / planned end
 *   cannot be before the current UTC calendar day.
 */
export function assertWorkOrderScheduleDates(
  input: {
    plannedStartAt?: Date | null;
    plannedEndAt?: Date | null;
    dueDate?: Date | null;
    expectedCompletionDate?: Date | null;
  },
  options?: { rejectPastDates?: boolean; now?: Date }
) {
  const { plannedStartAt, plannedEndAt, dueDate, expectedCompletionDate } = input;
  const now = options?.now ?? new Date();

  if (options?.rejectPastDates) {
    const today = utcDayStartMs(now);
    const pastChecks: Array<{ label: string; value?: Date | null }> = [
      { label: "Planned start", value: plannedStartAt },
      { label: "Planned end", value: plannedEndAt },
      { label: "Due date", value: dueDate },
      { label: "Expected completion", value: expectedCompletionDate }
    ];
    for (const { label, value } of pastChecks) {
      if (value && utcDayStartMs(value) < today) {
        throw new BadRequestException(`${label} cannot be in the past`);
      }
    }
  }

  assertNotEarlier("Planned end", plannedEndAt, "planned start", plannedStartAt);
  assertNotEarlier("Due date", dueDate, "planned start", plannedStartAt);
  assertNotEarlier("Expected completion", expectedCompletionDate, "planned start", plannedStartAt);
  assertNotEarlier("Due date", dueDate, "planned end", plannedEndAt);
  assertNotEarlier("Expected completion", expectedCompletionDate, "planned end", plannedEndAt);
  // Expected completion is the operational finish target; it must not land after the due date.
  assertNotEarlier("Due date", dueDate, "expected completion", expectedCompletionDate);
}

/** Non-negative finite money/quantity fields (0 allowed). Undefined/null skipped. */
export function assertWorkOrderNonNegativeNumber(field: string, value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new BadRequestException(`${field} must be a valid number`);
  }
  if (numeric < 0) {
    throw new BadRequestException(`${field} cannot be negative`);
  }

  return numeric;
}

export function assertWorkOrderCostFields(input: {
  estimatedCost?: unknown;
  estimatedHours?: unknown;
}) {
  const estimatedCost = assertWorkOrderNonNegativeNumber("Estimated cost", input.estimatedCost);
  // Hours remain strictly greater than 0 when provided (existing product rule).
  if (input.estimatedHours !== undefined && input.estimatedHours !== null && input.estimatedHours !== "") {
    const hours = typeof input.estimatedHours === "number" ? input.estimatedHours : Number(input.estimatedHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new BadRequestException("Estimated hours must be greater than 0");
    }
  }
  return { estimatedCost };
}
