import { AssetCondition, AssetStatus, VehicleStatus } from "@prisma/client";

import { allow, deny, firstDenial, type PolicyDecision } from "./policy-decision";

function requireTenant(tenantId?: string | null): PolicyDecision {
  return tenantId ? allow() : deny("TENANT_REQUIRED", undefined, "CRITICAL");
}

export type OrgPolicySnapshot = {
  slaWarningPct: number;
  slaBreachPct: number;
  slaEscalatePct: number;
  weekendsCountAsBusiness: boolean;
  holidays: string[];
  emergencyBypassesBudget: boolean;
  ptwStrict: boolean;
  ptwRequiredTaxonomyCodes: string[];
  approvalPurchaseLimit: number;
  approvalAdjustLimit: number;
};

export const DEFAULT_ORG_POLICY: OrgPolicySnapshot = {
  slaWarningPct: 75,
  slaBreachPct: 100,
  slaEscalatePct: 125,
  weekendsCountAsBusiness: false,
  holidays: [],
  emergencyBypassesBudget: true,
  ptwStrict: false,
  ptwRequiredTaxonomyCodes: [],
  approvalPurchaseLimit: 0,
  approvalAdjustLimit: 0
};

export function businessElapsedMs(input: {
  start: Date;
  end: Date;
  pausedMs?: number;
  weekendsCountAsBusiness: boolean;
  holidays: string[];
}): number {
  const start = input.start.getTime();
  const end = input.end.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }
  if (input.weekendsCountAsBusiness && input.holidays.length === 0) {
    return Math.max(0, end - start - (input.pausedMs ?? 0));
  }
  let elapsed = 0;
  const holiday = new Set(input.holidays);
  const cursor = new Date(start);
  while (cursor.getTime() < end) {
    const day = cursor.getUTCDay();
    const iso = cursor.toISOString().slice(0, 10);
    const skipWeekend = !input.weekendsCountAsBusiness && (day === 0 || day === 6);
    const skipHoliday = holiday.has(iso);
    if (!skipWeekend && !skipHoliday) {
      const next = Math.min(end, cursor.getTime() + 60 * 60 * 1000);
      elapsed += next - cursor.getTime();
      cursor.setTime(next);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(0, 0, 0, 0);
    }
  }
  return Math.max(0, elapsed - (input.pausedMs ?? 0));
}

export function evaluateSlaClock(input: {
  tenantId?: string | null;
  slaHours: number;
  createdAt: Date;
  now: Date;
  status?: string | null;
  pausedMs?: number;
  policy: OrgPolicySnapshot;
}): {
  consumedPct: number;
  remainingMs: number;
  stage: "OK" | "WARNING" | "BREACH" | "ESCALATED";
} {
  const targetMs = Math.max(1, input.slaHours) * 60 * 60 * 1000;
  const elapsed = businessElapsedMs({
        start: input.createdAt,
        end: input.now,
        pausedMs: input.pausedMs,
        weekendsCountAsBusiness: input.policy.weekendsCountAsBusiness,
        holidays: input.policy.holidays
      });
  const consumedPct = (elapsed / targetMs) * 100;
  const remainingMs = Math.max(0, targetMs - elapsed);
  let stage: "OK" | "WARNING" | "BREACH" | "ESCALATED" = "OK";
  if (consumedPct >= input.policy.slaEscalatePct) stage = "ESCALATED";
  else if (consumedPct >= input.policy.slaBreachPct) stage = "BREACH";
  else if (consumedPct >= input.policy.slaWarningPct) stage = "WARNING";
  return { consumedPct, remainingMs, stage };
}

export function resolveApprovalLevel(input: {
  tenantId?: string | null;
  action:
    | "STOCK_ADJUST"
    | "LARGE_PART_ISSUE"
    | "PURCHASE_REQUEST"
    | "WORK_ORDER_COST"
    | "GATE_OVERRIDE"
    | "VENDOR_SELECT"
    | "EMERGENCY_REPAIR"
    | "ASSET_DISPOSAL"
    | "BUDGET_VARIANCE";
  amount?: number;
  actorRole?: string | null;
  actorIsSubmitter?: boolean;
  delegatedRole?: string | null;
  policy: OrgPolicySnapshot;
}): PolicyDecision {
  const tenant = requireTenant(input.tenantId);
  if (!tenant.allowed) return tenant;
  if (input.actorIsSubmitter && ["PURCHASE_REQUEST", "STOCK_ADJUST", "WORK_ORDER_COST"].includes(input.action)) {
    return deny("MAKER_CHECKER_VIOLATION", { action: input.action }, "CRITICAL");
  }
  const role = input.delegatedRole ?? input.actorRole;
  const managers = ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "FINANCE"];
  const limit =
    input.action === "STOCK_ADJUST" ? input.policy.approvalAdjustLimit : input.policy.approvalPurchaseLimit;
  if (limit > 0 && (input.amount ?? 0) >= limit && !managers.includes(String(role ?? ""))) {
    return deny("APPROVAL_LIMIT_EXCEEDED", { action: input.action, amount: input.amount, limit });
  }
  if (!role) {
    return deny("USER_APPROVAL_UNAUTHORIZED", { action: input.action }, "CRITICAL");
  }
  return allow("APPROVAL_RESOLVED", { action: input.action, role });
}

export function canAssignTechnician(input: {
  tenantId?: string | null;
  employeeActive?: boolean;
  canReceiveWorkOrders?: boolean;
  onLeave?: boolean;
  leaveOverride?: boolean;
  skillMatch?: boolean;
  certificationRequired?: boolean;
  certified?: boolean;
  remainingHours?: number;
  estimatedHours?: number;
}): PolicyDecision {
  return firstDenial(
    requireTenant(input.tenantId),
    input.employeeActive === false ? deny("TECHNICIAN_INACTIVE") : allow(),
    input.canReceiveWorkOrders === false ? deny("TECHNICIAN_NOT_DISPATCHABLE") : allow(),
    input.onLeave && !input.leaveOverride ? deny("TECHNICIAN_ON_LEAVE") : allow(),
    input.certificationRequired && input.certified === false
      ? deny("TECHNICIAN_CERTIFICATION_REQUIRED", undefined, "CRITICAL")
      : allow(),
    input.skillMatch === false ? deny("TECHNICIAN_SKILL_MISMATCH", undefined, "WARNING") : allow(),
    (input.remainingHours ?? 8) < (input.estimatedHours ?? 0)
      ? deny("TECHNICIAN_OVER_CAPACITY", {
          remainingHours: input.remainingHours,
          estimatedHours: input.estimatedHours
        })
      : allow()
  );
}

export function canStartHazardousWork(input: {
  tenantId?: string | null;
  hazardous?: boolean;
  permitEvidencePresent?: boolean;
  overrideAuthorized?: boolean;
  overrideReason?: string | null;
  policy: OrgPolicySnapshot;
}): PolicyDecision {
  const tenant = requireTenant(input.tenantId);
  if (!tenant.allowed) return tenant;
  if (!input.hazardous) return allow("PTW_NOT_REQUIRED");
  if (input.permitEvidencePresent) return allow("PTW_AUTHORIZED");
  if (input.overrideAuthorized && input.overrideReason?.trim()) {
    return allow("PTW_OVERRIDE", { reason: input.overrideReason });
  }
  if (!input.policy.ptwStrict) {
    return allow("BUSINESS_APPROVAL_REQUIRED", { hazardous: true });
  }
  return deny("BUSINESS_APPROVAL_REQUIRED", { hazardous: true }, "CRITICAL");
}

export function canCommitBudget(input: {
  tenantId?: string | null;
  budgetAmount?: number | null;
  committed?: number;
  requested?: number;
  emergency?: boolean;
  policy: OrgPolicySnapshot;
}): PolicyDecision {
  const tenant = requireTenant(input.tenantId);
  if (!tenant.allowed) return tenant;
  if (input.budgetAmount == null || !Number.isFinite(input.budgetAmount)) {
    return allow("INSUFFICIENT_DATA", { coverage: "INSUFFICIENT_DATA" });
  }
  const next = (input.committed ?? 0) + (input.requested ?? 0);
  if (next <= input.budgetAmount) return allow("BUDGET_AVAILABLE", { remaining: input.budgetAmount - next });
  if (input.emergency && input.policy.emergencyBypassesBudget) {
    return allow("BUDGET_EMERGENCY_OVERRIDE", { overBy: next - input.budgetAmount });
  }
  return deny("BUDGET_EXCEEDED", { budget: input.budgetAmount, committed: next });
}

export function matchThreeWay(input: {
  orderedQty: number;
  receivedQty: number;
  invoicedQty?: number | null;
  poPrice?: number | null;
  invoicePrice?: number | null;
}): {
  result: "MATCH" | "PARTIAL_RECEIPT" | "QUANTITY_VARIANCE" | "PRICE_VARIANCE" | "OVER_INVOICE" | "INSUFFICIENT_DATA";
  quantityVariance: number;
  priceVariance: number | null;
} {
  const quantityVariance = input.receivedQty - input.orderedQty;
  if (input.invoicedQty == null || input.invoicePrice == null || input.poPrice == null) {
    if (input.receivedQty <= 0) return { result: "INSUFFICIENT_DATA", quantityVariance, priceVariance: null };
    if (input.receivedQty < input.orderedQty) {
      return { result: "PARTIAL_RECEIPT", quantityVariance, priceVariance: null };
    }
    if (quantityVariance !== 0) return { result: "QUANTITY_VARIANCE", quantityVariance, priceVariance: null };
    return { result: "INSUFFICIENT_DATA", quantityVariance, priceVariance: null };
  }
  const priceVariance = input.invoicePrice - input.poPrice;
  if (input.invoicedQty > input.receivedQty) {
    return { result: "OVER_INVOICE", quantityVariance: input.invoicedQty - input.receivedQty, priceVariance };
  }
  if (priceVariance !== 0) return { result: "PRICE_VARIANCE", quantityVariance, priceVariance };
  if (input.receivedQty < input.orderedQty) return { result: "PARTIAL_RECEIPT", quantityVariance, priceVariance };
  if (quantityVariance !== 0) return { result: "QUANTITY_VARIANCE", quantityVariance, priceVariance };
  return { result: "MATCH", quantityVariance: 0, priceVariance: 0 };
}

export function canUseVendor(input: {
  tenantId?: string | null;
  active?: boolean;
  blacklisted?: boolean;
  contractExpiresAt?: Date | null;
  insuranceExpiresAt?: Date | null;
  now?: Date;
}): PolicyDecision {
  const decision = evaluateVendorEligibility({
    tenantId: input.tenantId,
    active: input.active !== false,
    blacklisted: Boolean(input.blacklisted),
    insuranceRequired: input.insuranceExpiresAt != null,
    insuranceExpiresAt: input.insuranceExpiresAt,
    contracts: input.contractExpiresAt
      ? [{ startDate: new Date(0), endDate: input.contractExpiresAt, isActive: true }]
      : [],
    now: input.now
  });
  if (decision.assignmentAllowed) return allow(decision.reasons[0]?.code);
  const blocking = decision.reasons.find((reason) => reason.blocksAssignment) ?? decision.reasons[0];
  return deny(blocking?.code ?? "VENDOR_INELIGIBLE", undefined, decision.availability === "BLOCKED" ? "CRITICAL" : "HIGH");
}

export const VENDOR_EXPIRY_WARNING_DAYS = 30;

export type VendorDocumentState = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "MISSING" | "NOT_REQUIRED" | "NOT_YET_EFFECTIVE";

export type VendorEligibilityReason = {
  code: string;
  message: string;
  blocksAssignment: boolean;
};

export type VendorEligibilityDecision = {
  availability: "ACTIVE" | "INACTIVE" | "BLOCKED";
  eligibility: "ELIGIBLE" | "INELIGIBLE" | "NEEDS_REVIEW";
  assignmentAllowed: boolean;
  reasons: VendorEligibilityReason[];
  contract: { state: VendorDocumentState; startDate: string | null; endDate: string | null };
  insurance: { state: VendorDocumentState; expiresAt: string | null; required: boolean };
  evaluatedAt: string;
  timezone: "Asia/Colombo";
};

function businessDateOnly(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(value);
}

function businessDayEnd(value: Date) {
  return new Date(`${businessDateOnly(value)}T23:59:59.999+05:30`);
}

function businessDayStart(value: Date) {
  return new Date(`${businessDateOnly(value)}T00:00:00.000+05:30`);
}

export function evaluateVendorEligibility(input: {
  tenantId?: string | null;
  active: boolean;
  blacklisted: boolean;
  insuranceRequired?: boolean;
  insuranceExpiresAt?: Date | null;
  contracts?: Array<{ startDate: Date; endDate: Date; isActive?: boolean; reminderDays?: number | null }>;
  now?: Date;
}): VendorEligibilityDecision {
  const now = input.now ?? new Date();
  const reasons: VendorEligibilityReason[] = [];
  if (!input.tenantId) {
    reasons.push({
      code: "TENANT_REQUIRED",
      message: "This vendor is not tied to a tenant, so eligibility cannot be confirmed.",
      blocksAssignment: true
    });
  }
  if (input.blacklisted) {
    reasons.push({
      code: "VENDOR_BLOCKED",
      message: "This vendor is blocked and cannot receive new work.",
      blocksAssignment: true
    });
  }
  if (!input.active) {
    reasons.push({
      code: "VENDOR_INACTIVE",
      message: "This vendor is inactive and cannot receive new work.",
      blocksAssignment: true
    });
  }

  const contracts = (input.contracts ?? []).filter((contract) => contract.isActive !== false);
  let contractState: VendorDocumentState = "NOT_REQUIRED";
  let contractStart: string | null = null;
  let contractEnd: string | null = null;
  if (contracts.length > 0) {
    const covering = contracts.filter((contract) => {
      if (contract.startDate.getTime() > contract.endDate.getTime()) return false;
      return businessDayStart(contract.startDate).getTime() <= now.getTime() && businessDayEnd(contract.endDate).getTime() >= now.getTime();
    });
    const invalid = contracts.filter((contract) => contract.startDate.getTime() > contract.endDate.getTime());
    const chosen = covering[0] ?? contracts.slice().sort((a, b) => b.endDate.getTime() - a.endDate.getTime())[0];
    contractStart = chosen?.startDate.toISOString() ?? null;
    contractEnd = chosen?.endDate.toISOString() ?? null;
    if (invalid.length > 0 && covering.length === 0) {
      contractState = "MISSING";
      reasons.push({
        code: "CONTRACT_DATE_RANGE_INVALID",
        message: "A contract has an end date before its start date.",
        blocksAssignment: true
      });
    } else if (covering.length > 0) {
      const windowDays = covering[0].reminderDays ?? VENDOR_EXPIRY_WARNING_DAYS;
      const warningMs = windowDays * 24 * 60 * 60 * 1000;
      contractState = businessDayEnd(covering[0].endDate).getTime() - now.getTime() <= warningMs ? "EXPIRING_SOON" : "VALID";
    } else if (contracts.every((contract) => businessDayStart(contract.startDate).getTime() > now.getTime())) {
      contractState = "NOT_YET_EFFECTIVE";
      reasons.push({
        code: "CONTRACT_NOT_YET_EFFECTIVE",
        message: "The contract has not started, so this vendor cannot take new work yet.",
        blocksAssignment: true
      });
    } else {
      contractState = "EXPIRED";
      reasons.push({
        code: "VENDOR_CONTRACT_EXPIRED",
        message: "The contract has expired. New work cannot be assigned until it is renewed.",
        blocksAssignment: true
      });
    }
  }

  const insuranceRequired = Boolean(input.insuranceRequired);
  let insuranceState: VendorDocumentState = insuranceRequired ? "MISSING" : "NOT_REQUIRED";
  if (insuranceRequired && input.insuranceExpiresAt) {
    const expires = businessDayEnd(input.insuranceExpiresAt);
    if (expires.getTime() < now.getTime()) {
      insuranceState = "EXPIRED";
      reasons.push({
        code: "VENDOR_INSURANCE_EXPIRED",
        message: "Required insurance has expired. New work cannot be assigned.",
        blocksAssignment: true
      });
    } else if (expires.getTime() - now.getTime() <= VENDOR_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000) {
      insuranceState = "EXPIRING_SOON";
    } else {
      insuranceState = "VALID";
    }
  } else if (insuranceRequired) {
    reasons.push({
      code: "INSURANCE_MISSING",
      message: "Required insurance has no expiry date, so this vendor needs review before assignment.",
      blocksAssignment: true
    });
  }

  const blocking = reasons.filter((reason) => reason.blocksAssignment);
  const hardBlock = blocking.some((reason) =>
    ["VENDOR_BLOCKED", "VENDOR_INACTIVE", "VENDOR_CONTRACT_EXPIRED", "VENDOR_INSURANCE_EXPIRED", "TENANT_REQUIRED"].includes(reason.code)
  );
  const eligibility = hardBlock ? "INELIGIBLE" : blocking.length > 0 ? "NEEDS_REVIEW" : "ELIGIBLE";
  return {
    availability: input.blacklisted ? "BLOCKED" : input.active ? "ACTIVE" : "INACTIVE",
    eligibility,
    assignmentAllowed: blocking.length === 0,
    reasons,
    contract: { state: contractState, startDate: contractStart, endDate: contractEnd },
    insurance: {
      state: insuranceState,
      expiresAt: input.insuranceExpiresAt?.toISOString() ?? null,
      required: insuranceRequired
    },
    evaluatedAt: now.toISOString(),
    timezone: "Asia/Colombo"
  };
}

export function canRecordFuel(input: {
  tenantId?: string | null;
  liters: number;
  mileage: number;
  previousMileage: number;
  vehicleStatus?: string | null;
  duplicateReference?: boolean;
}): PolicyDecision {
  return firstDenial(
    requireTenant(input.tenantId),
    input.vehicleStatus === VehicleStatus.OUT_OF_SERVICE || input.vehicleStatus === VehicleStatus.DISPOSED
      ? deny("VEHICLE_OUT_OF_SERVICE")
      : allow(),
    input.liters <= 0 ? deny("FUEL_QUANTITY_INVALID") : allow(),
    input.mileage < 0 ? deny("METER_NEGATIVE") : allow(),
    input.mileage < input.previousMileage ? deny("METER_ROLLBACK") : allow(),
    input.duplicateReference ? deny("FUEL_DUPLICATE_REFERENCE") : allow()
  );
}

export function canStartTrip(input: {
  tenantId?: string | null;
  vehicleStatus?: string | null;
  driverActive?: boolean;
  driverLicenseExpired?: boolean;
  conflictingTrip?: boolean;
  mileage: number;
  previousMileage: number;
}): PolicyDecision {
  return firstDenial(
    requireTenant(input.tenantId),
    input.vehicleStatus === VehicleStatus.UNDER_MAINTENANCE ? deny("VEHICLE_UNDER_MAINTENANCE") : allow(),
    input.vehicleStatus === VehicleStatus.OUT_OF_SERVICE ? deny("VEHICLE_OUT_OF_SERVICE") : allow(),
    input.driverActive === false ? deny("DRIVER_INVALID") : allow(),
    input.driverLicenseExpired ? deny("DRIVER_LICENSE_EXPIRED", undefined, "CRITICAL") : allow(),
    input.conflictingTrip ? deny("TRIP_CONFLICT") : allow(),
    input.mileage < input.previousMileage ? deny("METER_ROLLBACK") : allow()
  );
}

export function canApplyOfflineMutation(input: {
  tenantId?: string | null;
  clientActionId?: string | null;
  serverAvailable?: number;
  requested?: number;
}): PolicyDecision {
  return firstDenial(
    requireTenant(input.tenantId),
    input.clientActionId ? allow() : deny("OFFLINE_CLIENT_ACTION_REQUIRED"),
    input.serverAvailable != null && input.requested != null && input.requested > input.serverAvailable
      ? deny("INSUFFICIENT_STOCK", { available: input.serverAvailable, requested: input.requested }, "CRITICAL")
      : allow()
  );
}

export function scoreAssetCriticality(input: {
  condition?: AssetCondition | string | null;
  safetyImpact?: boolean;
  productionImpact?: boolean;
  noBackup?: boolean;
  storedCriticality?: string | null;
}): { band: string; reasons: string[] } {
  if (input.storedCriticality) {
    return { band: input.storedCriticality, reasons: [`Configured criticality ${input.storedCriticality}`] };
  }
  const reasons: string[] = [];
  let score = 0;
  if (input.condition === AssetCondition.CRITICAL || input.condition === "CRITICAL") {
    score += 40;
    reasons.push("Asset condition is CRITICAL");
  } else if (input.condition === AssetCondition.POOR) {
    score += 25;
    reasons.push("Asset condition is POOR");
  }
  if (input.safetyImpact) {
    score += 30;
    reasons.push("Safety impact");
  }
  if (input.productionImpact) {
    score += 20;
    reasons.push("Production impact");
  }
  if (input.noBackup) {
    score += 10;
    reasons.push("No backup asset");
  }
  const band = score >= 70 ? "SAFETY" : score >= 45 ? "PRODUCTION" : score >= 20 ? "STANDARD" : "LOW";
  return { band, reasons: reasons.length ? reasons : ["Insufficient impact data; default LOW"] };
}

export function scoreAssetHealth(input: {
  status?: AssetStatus | string | null;
  overdueMaintenance?: boolean;
  openCriticalWorkOrders?: number;
  downtimeHours90d?: number | null;
  condition?: AssetCondition | string | null;
}): { score: number; band: string; reasons: string[]; coverage: string } {
  const reasons: string[] = [];
  let score = 100;
  if (input.status === AssetStatus.INACTIVE || input.status === AssetStatus.DISPOSED || input.status === AssetStatus.RETIRED) {
    score -= 40;
    reasons.push(`Status ${input.status}`);
  }
  if (input.status === AssetStatus.UNDER_MAINTENANCE) {
    score -= 15;
    reasons.push("Currently under maintenance");
  }
  if (input.overdueMaintenance) {
    score -= 20;
    reasons.push("Maintenance overdue");
  }
  if ((input.openCriticalWorkOrders ?? 0) > 0) {
    score -= Math.min(30, (input.openCriticalWorkOrders ?? 0) * 10);
    reasons.push(`${input.openCriticalWorkOrders} critical open work orders`);
  }
  if (input.condition === AssetCondition.POOR || input.condition === AssetCondition.CRITICAL) {
    score -= 15;
    reasons.push(`Condition ${input.condition}`);
  }
  if (input.downtimeHours90d == null) {
    return {
      score: Math.max(0, Math.min(100, score)),
      band: bandFor(score),
      reasons: [...reasons, "Downtime coverage INSUFFICIENT_DATA"],
      coverage: "INSUFFICIENT_DATA"
    };
  }
  if (input.downtimeHours90d > 48) {
    score -= 15;
    reasons.push(`Downtime ${input.downtimeHours90d} hours in 90 days`);
  }
  const clamped = Math.max(0, Math.min(100, score));
  return { score: clamped, band: bandFor(clamped), reasons, coverage: "COMPLETE" };
}

function bandFor(score: number): string {
  if (score >= 80) return "HEALTHY";
  if (score >= 60) return "ATTENTION";
  if (score >= 40) return "HIGH_RISK";
  return "CRITICAL";
}

export function mttrMtbf(samples: Array<{ downtimeHours: number; operatingHours?: number }>): {
  mttrHours: number | null;
  mtbfHours: number | null;
  coverage: string;
} {
  if (samples.length < 3) {
    return { mttrHours: null, mtbfHours: null, coverage: "INSUFFICIENT_DATA" };
  }
  const mttrHours = samples.reduce((sum, row) => sum + row.downtimeHours, 0) / samples.length;
  const operating = samples.filter((row) => row.operatingHours != null && (row.operatingHours ?? 0) > 0);
  if (operating.length < 3) {
    return { mttrHours, mtbfHours: null, coverage: "INSUFFICIENT_DATA" };
  }
  const mtbfHours = operating.reduce((sum, row) => sum + (row.operatingHours ?? 0), 0) / operating.length;
  return { mttrHours, mtbfHours, coverage: "COMPLETE" };
}
