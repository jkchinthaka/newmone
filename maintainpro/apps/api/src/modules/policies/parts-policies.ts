import { allow, deny, type PolicyDecision } from "./policy-decision";

export type CompatibilityResult = "COMPATIBLE" | "UNKNOWN" | "INCOMPATIBLE";

export type PartCompatibilityRule = {
  vehicleType?: string | null;
  make?: string | null;
  vehicleModel?: string | null;
  engineCode?: string | null;
  assetId?: string | null;
};

export type VehicleCompatibilityTarget = {
  type?: string | null;
  make?: string | null;
  vehicleModel?: string | null;
  engineNo?: string | null;
  assetId?: string | null;
};

export function evaluatePartCompatibility(
  rules: PartCompatibilityRule[],
  vehicle?: VehicleCompatibilityTarget | null
): CompatibilityResult {
  if (!vehicle || rules.length === 0) {
    return "UNKNOWN";
  }

  let sawComparable = false;
  for (const rule of rules) {
    const comparable =
      Boolean(rule.vehicleType) ||
      Boolean(rule.make) ||
      Boolean(rule.vehicleModel) ||
      Boolean(rule.engineCode) ||
      Boolean(rule.assetId);
    if (!comparable) {
      continue;
    }
    sawComparable = true;
    if (matchesRule(rule, vehicle)) {
      return "COMPATIBLE";
    }
  }

  return sawComparable ? "INCOMPATIBLE" : "UNKNOWN";
}

export function canIssuePartToVehicle(input: {
  compatibility: CompatibilityResult;
  overrideRequested?: boolean;
  overrideAuthorized?: boolean;
  overrideReason?: string | null;
}): PolicyDecision {
  if (input.compatibility === "COMPATIBLE" || input.compatibility === "UNKNOWN") {
    return allow(input.compatibility === "UNKNOWN" ? "PART_COMPATIBILITY_UNKNOWN" : "ALLOWED");
  }
  if (!input.overrideRequested) {
    return deny("PART_INCOMPATIBLE", { compatibility: input.compatibility });
  }
  if (!input.overrideAuthorized) {
    return deny("OVERRIDE_UNAUTHORIZED", { compatibility: input.compatibility }, "CRITICAL");
  }
  if (!input.overrideReason?.trim()) {
    return deny("OVERRIDE_REASON_REQUIRED", { compatibility: input.compatibility });
  }
  return allow("PART_INCOMPATIBLE_OVERRIDE");
}

export function isWithinWarranty(input: {
  installedAt?: Date | null;
  installedMileage?: number | null;
  warrantyExpiresAt?: Date | null;
  warrantyMileage?: number | null;
  failedAt: Date;
  failedMileage?: number | null;
}): boolean {
  const dateOk =
    !input.warrantyExpiresAt || input.failedAt.getTime() <= input.warrantyExpiresAt.getTime();
  const mileageOk =
    input.warrantyMileage == null ||
    input.failedMileage == null ||
    input.installedMileage == null ||
    input.failedMileage - input.installedMileage <= input.warrantyMileage;
  return dateOk && mileageOk;
}

function matchesRule(rule: PartCompatibilityRule, vehicle: VehicleCompatibilityTarget): boolean {
  if (rule.assetId && rule.assetId !== vehicle.assetId) {
    return false;
  }
  if (rule.vehicleType && rule.vehicleType !== vehicle.type) {
    return false;
  }
  if (rule.make && normalize(rule.make) !== normalize(vehicle.make)) {
    return false;
  }
  if (rule.vehicleModel && normalize(rule.vehicleModel) !== normalize(vehicle.vehicleModel)) {
    return false;
  }
  if (rule.engineCode && normalize(rule.engineCode) !== normalize(vehicle.engineNo)) {
    return false;
  }
  return true;
}

function normalize(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}
