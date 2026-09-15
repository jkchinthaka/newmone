/**
 * Fleet lifecycle pure-function policies.
 * All functions here are side-effect-free and unit-testable without Prisma.
 * Gate outcome is backend-authoritative; no client may bypass these checks.
 */

export type GateCheckInput = {
  vehicleActive: boolean;
  driverActive: boolean;
  driverLicenceValid: boolean;
  insuranceValid: boolean;
  revenueLicenceValid: boolean;
  criticalServiceOverdue: boolean;
  criticalInspectionDefect: boolean;
  blockFlag: boolean;
  // Warning-level inputs (do not block; surfaced as warnings)
  pmDueSoon?: boolean;
  docExpiringSoon?: boolean;
  insuranceExpiringSoon?: boolean;
};

export type GateDecision = {
  allowed: boolean;
  blockedReasons: string[];
  warnings: string[];
  canOverride: boolean;
};

export function evaluateGateOut(input: GateCheckInput): GateDecision {
  const blockedReasons: string[] = [];

  if (!input.vehicleActive) blockedReasons.push("VEHICLE_INACTIVE");
  if (!input.driverActive) blockedReasons.push("DRIVER_INACTIVE");
  if (!input.driverLicenceValid) blockedReasons.push("DRIVER_LICENCE_INVALID");
  if (!input.insuranceValid) blockedReasons.push("INSURANCE_INVALID");
  if (!input.revenueLicenceValid) blockedReasons.push("REVENUE_LICENCE_INVALID");
  if (input.criticalServiceOverdue) blockedReasons.push("CRITICAL_SERVICE_OVERDUE");
  if (input.criticalInspectionDefect) blockedReasons.push("CRITICAL_INSPECTION_DEFECT");
  if (input.blockFlag) blockedReasons.push("BLOCK_FLAG");

  // Non-blocking warnings surfaced to operator — does not prevent gate-out
  const warnings: string[] = [];
  if (input.pmDueSoon) warnings.push("PM_DUE_SOON");
  if (input.docExpiringSoon) warnings.push("DOCUMENT_EXPIRING_SOON");
  if (input.insuranceExpiringSoon) warnings.push("INSURANCE_EXPIRING_SOON");

  return {
    allowed: blockedReasons.length === 0,
    blockedReasons,
    warnings,
    canOverride: blockedReasons.length > 0
  };
}

export type GateOverrideInput = {
  hasPermission: boolean;
  reason?: string | null;
  approvalRequired?: boolean;
  approved?: boolean;
};

export function authorizeGateOverride(input: GateOverrideInput): {
  allowed: boolean;
  code: string;
} {
  if (!input.hasPermission) return { allowed: false, code: "OVERRIDE_PERMISSION_DENIED" };
  if (!input.reason || !String(input.reason).trim()) {
    return { allowed: false, code: "OVERRIDE_REASON_REQUIRED" };
  }
  // Approval engine integration: if approval required and not yet approved, block override.
  if (input.approvalRequired && !input.approved) {
    return { allowed: false, code: "OVERRIDE_APPROVAL_REQUIRED" };
  }
  return { allowed: true, code: "OVERRIDE_APPROVED" };
}

export function fuelEfficiency(input: {
  litres: number;
  distanceKm: number;
  amount: number;
}): { kmPerLitre: number | null; costPerKm: number | null; abnormal: boolean } {
  if (!(input.litres > 0) || !(input.distanceKm > 0)) {
    return { kmPerLitre: null, costPerKm: null, abnormal: false };
  }
  const kmPerLitre = input.distanceKm / input.litres;
  const costPerKm = input.amount / input.distanceKm;
  // Soft anomaly band — configurable later; not a certified threshold.
  const abnormal = kmPerLitre < 3 || kmPerLitre > 40;
  return { kmPerLitre, costPerKm, abnormal };
}

/**
 * costPerKm returns null when distanceKm is 0 or negative to prevent division errors.
 */
export function costPerKm(input: {
  maintenanceCost: number;
  distanceKm: number;
}): number | null {
  if (input.distanceKm <= 0) return null;
  return input.maintenanceCost / input.distanceKm;
}

export type AccidentClaimLinkage = {
  accidentId: string;
  damageAssessmentId?: string | null;
  repairWorkOrderId?: string | null;
  insuranceClaimId?: string | null;
  completed?: boolean;
};

export function validateAccidentRepairClaimChain(link: AccidentClaimLinkage): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!link.accidentId) missing.push("ACCIDENT");
  if (!link.repairWorkOrderId) missing.push("REPAIR_WO");
  // Insurance claim is optional when not insured.
  return { valid: missing.length === 0, missing };
}

/**
 * Pure helper — asserts that installing a tyre at a given wheel position won't
 * conflict with an already-active tyre at the same position.
 * Returns true when there is a conflict (another active tyre at that position).
 */
export function hasActiveTyreConflict(
  existingActiveTyres: Array<{ wheelPosition?: string | null; isActive: boolean }>,
  wheelPosition: string
): boolean {
  return existingActiveTyres.some(
    (t) => t.isActive && t.wheelPosition === wheelPosition
  );
}
