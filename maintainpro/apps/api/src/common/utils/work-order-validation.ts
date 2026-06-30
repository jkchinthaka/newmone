import { BadRequestException } from "@nestjs/common";
import { WorkOrderType } from "@prisma/client";

/** Work order types that must link to an asset or vehicle (machine-specific maintenance). */
export const ASSET_OR_VEHICLE_REQUIRED_TYPES = new Set<WorkOrderType>([
  WorkOrderType.PREVENTIVE,
  WorkOrderType.INSPECTION,
  WorkOrderType.INSTALLATION,
  WorkOrderType.ACCIDENT_REPAIR
]);

export function normalizeOptionalObjectId(value?: string | null): string | undefined {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function assertValidOptionalObjectId(field: string, value?: string | null) {
  const normalized = normalizeOptionalObjectId(value);
  if (!normalized) {
    return undefined;
  }

  if (!/^[a-fA-F0-9]{24}$/.test(normalized)) {
    throw new BadRequestException(
      `Invalid ${field}: "${normalized}". Expected a 24-character hex ObjectId, or leave the field empty.`
    );
  }

  return normalized;
}

export function assertWorkOrderAssetRules(input: {
  type: WorkOrderType;
  assetId?: string | null;
  vehicleId?: string | null;
}) {
  const assetId = normalizeOptionalObjectId(input.assetId);
  const vehicleId = normalizeOptionalObjectId(input.vehicleId);

  if (ASSET_OR_VEHICLE_REQUIRED_TYPES.has(input.type) && !assetId && !vehicleId) {
    throw new BadRequestException(
      `Work order type ${input.type} requires an asset or vehicle link. General tasks (CORRECTIVE, EMERGENCY) may omit both.`
    );
  }

  return { assetId, vehicleId };
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
  if (input.status === "COMPLETED" || input.status === "CANCELLED") {
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
