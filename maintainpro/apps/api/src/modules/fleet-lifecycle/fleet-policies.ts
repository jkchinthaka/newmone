export type GateCheckInput = {
  vehicleActive: boolean;
  driverActive: boolean;
  driverLicenceValid: boolean;
  insuranceValid: boolean;
  revenueLicenceValid: boolean;
  criticalServiceOverdue: boolean;
  criticalInspectionDefect: boolean;
  blockFlag: boolean;
};

export type GateDecision = {
  allowed: boolean;
  blockedReasons: string[];
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
  return {
    allowed: blockedReasons.length === 0,
    blockedReasons,
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
  // Soft anomaly band — configurable later; not a Nelna-certified threshold.
  const abnormal = kmPerLitre < 3 || kmPerLitre > 40;
  return { kmPerLitre, costPerKm, abnormal };
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
  // Claim is optional when not insured.
  return { valid: missing.length === 0, missing };
}
