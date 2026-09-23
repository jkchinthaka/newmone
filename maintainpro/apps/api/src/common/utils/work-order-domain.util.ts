import { BadRequestException } from "@nestjs/common";

import { type JobDomain, isJobDomain, parseJobDomain } from "./job-domain.util";
import { normalizeOptionalObjectId } from "./work-order-validation";

/** Functional / workshop / road test outcomes for domain completion. */
export const DOMAIN_TEST_RESULTS = [
  "PASS",
  "FAIL",
  "PARTIAL",
  "NOT_REQUIRED",
  "WORKSHOP_TEST_PASS",
  "ROAD_TEST_PASS",
  "ROAD_TEST_NOT_REQUIRED"
] as const;

export type DomainTestResult = (typeof DOMAIN_TEST_RESULTS)[number];

export const PRODUCTION_IMPACT_VALUES = ["STOPPED", "REDUCED", "NONE"] as const;
export type ProductionImpactValue = (typeof PRODUCTION_IMPACT_VALUES)[number];

const FAILED_TEST_RESULTS = new Set<string>(["FAIL", "PARTIAL"]);

/**
 * Enforce canonical subject for an explicit jobDomain.
 * Explicit domain lanes must not silently fall through to another subject type.
 */
export function assertJobDomainSubjects(input: {
  jobDomain?: string | null;
  assetId?: string | null;
  vehicleId?: string | null;
  functionalLocationId?: string | null;
}): JobDomain | undefined {
  const domain = parseJobDomain(input.jobDomain);
  if (!domain) {
    return undefined;
  }

  const assetId = normalizeOptionalObjectId(input.assetId);
  const vehicleId = normalizeOptionalObjectId(input.vehicleId);
  const functionalLocationId = normalizeOptionalObjectId(input.functionalLocationId);

  if (domain === "MACHINERY" && !assetId) {
    throw new BadRequestException("MACHINERY work orders require a canonical Asset / Machine.");
  }
  if (domain === "VEHICLE" && !vehicleId) {
    throw new BadRequestException("VEHICLE work orders require a canonical Vehicle.");
  }
  if (domain === "SERVICE" && !functionalLocationId) {
    throw new BadRequestException(
      "SERVICE work orders require an exact Functional Location / Facility. Approximate location is not sufficient."
    );
  }

  return domain;
}

export function parseDomainTestResult(value?: string | null): DomainTestResult | undefined {
  if (value == null) return undefined;
  const normalized = String(value).trim().toUpperCase();
  if (!normalized) return undefined;
  if (!(DOMAIN_TEST_RESULTS as readonly string[]).includes(normalized)) {
    throw new BadRequestException(
      `Invalid test result "${value}". Expected one of: ${DOMAIN_TEST_RESULTS.join(", ")}.`
    );
  }
  return normalized as DomainTestResult;
}

export function parseProductionImpact(value?: string | null): ProductionImpactValue | undefined {
  if (value == null) return undefined;
  const normalized = String(value).trim().toUpperCase();
  if (!normalized) return undefined;
  if (!(PRODUCTION_IMPACT_VALUES as readonly string[]).includes(normalized)) {
    throw new BadRequestException(
      `Invalid production impact "${value}". Expected STOPPED, REDUCED, or NONE.`
    );
  }
  return normalized as ProductionImpactValue;
}

export function isFailedDomainTest(result?: string | null): boolean {
  const normalized = String(result ?? "")
    .trim()
    .toUpperCase();
  return FAILED_TEST_RESULTS.has(normalized);
}

/**
 * Technician completion must not succeed when a mandatory domain test failed.
 * NOT_REQUIRED / PASS allow completion; FAIL / PARTIAL block (or force rework upstream).
 */
export function assertDomainTestAllowsCompletion(input: {
  jobDomain?: string | null;
  functionalTestResult?: string | null;
  roadTestResult?: string | null;
  requireFunctionalTest?: boolean;
  requireRoadTest?: boolean;
}) {
  const domain = parseJobDomain(input.jobDomain);
  const functional = parseDomainTestResult(input.functionalTestResult);
  const road = parseDomainTestResult(input.roadTestResult);

  if (domain === "MACHINERY" || domain === "SERVICE") {
    if (input.requireFunctionalTest && !functional) {
      throw new BadRequestException("Functional test result is required before technician completion.");
    }
    if (isFailedDomainTest(functional)) {
      throw new BadRequestException(
        "Failed or partial functional test blocks technician completion. Send to rework or record NOT_REQUIRED when policy allows."
      );
    }
  }

  if (domain === "VEHICLE") {
    if (input.requireRoadTest && !road && !functional) {
      throw new BadRequestException(
        "Vehicle functional/road test result is required before technician completion."
      );
    }
    if (isFailedDomainTest(functional) || isFailedDomainTest(road)) {
      throw new BadRequestException(
        "Failed or partial vehicle test blocks technician completion and return-to-service."
      );
    }
  }
}

/**
 * Return-to-service / release must fail closed on failed tests or critical open WOs.
 */
export function assertDomainReleaseAllowed(input: {
  jobDomain?: string | null;
  functionalTestResult?: string | null;
  roadTestResult?: string | null;
  temporaryRepair?: boolean;
  operatingRestriction?: string | null;
  criticalOpenWorkOrderCount?: number;
  complianceBlocksRoadRelease?: boolean;
  allowMaintenanceCompleteWhileComplianceBlocked?: boolean;
  /** When true, temporary+restriction may proceed to a restricted (non-AVAILABLE) operational status. */
  allowRestrictedRelease?: boolean;
}) {
  if (isFailedDomainTest(input.functionalTestResult) || isFailedDomainTest(input.roadTestResult)) {
    throw new BadRequestException(
      "Cannot return target to service while a mandatory functional/road test is failed or partial."
    );
  }

  if ((input.criticalOpenWorkOrderCount ?? 0) > 0) {
    throw new BadRequestException(
      "Cannot return vehicle/asset to service while another critical open work order exists on the same target."
    );
  }

  if (
    input.temporaryRepair &&
    input.operatingRestriction?.trim() &&
    !input.allowRestrictedRelease
  ) {
    throw new BadRequestException(
      "Temporary repair with an operating restriction cannot return the target to unrestricted service. Clear the restriction or keep the target out of normal service."
    );
  }

  if (input.complianceBlocksRoadRelease && !input.allowMaintenanceCompleteWhileComplianceBlocked) {
    throw new BadRequestException(
      "Compliance status blocks road release. Maintenance may be complete, but the vehicle cannot be marked available for road use."
    );
  }
}

export function assertMonotonicMeterReading(input: {
  previous?: number | null;
  next?: number | null;
  label?: string;
}) {
  const label = input.label ?? "Meter reading";
  if (input.next == null || !Number.isFinite(Number(input.next))) {
    throw new BadRequestException(`${label} is required and must be a finite number.`);
  }
  if (Number(input.next) < 0) {
    throw new BadRequestException(`${label} cannot be negative.`);
  }
  if (
    input.previous != null &&
    Number.isFinite(Number(input.previous)) &&
    Number(input.next) < Number(input.previous)
  ) {
    throw new BadRequestException(
      `${label} ${input.next} is lower than last accepted reading ${input.previous}. Use a governed correction instead of decreasing the reading.`
    );
  }
}

export function formatAssetIdentity(asset?: {
  assetTag?: string | null;
  assetCode?: string | null;
  name?: string | null;
  id?: string;
} | null): string {
  if (!asset) return "—";
  const code = (asset.assetTag ?? asset.assetCode)?.trim();
  const name = asset.name?.trim();
  if (code && name) return `${code} — ${name}`;
  return code || name || "Asset";
}

export function formatLocationIdentity(location?: {
  code?: string | null;
  name?: string | null;
  id?: string;
} | null): string {
  if (!location) return "—";
  const code = location.code?.trim();
  const name = location.name?.trim();
  if (code && name) return `${code} — ${name}`;
  return code || name || "Location";
}

export function formatVehicleIdentity(vehicle?: {
  registrationNo?: string | null;
  vehicleCode?: string | null;
  assetTag?: string | null;
  make?: string | null;
  model?: string | null;
  vehicleModel?: string | null;
  name?: string | null;
  id?: string;
} | null): string {
  if (!vehicle) return "—";
  const reg = vehicle.registrationNo?.trim();
  const code = (vehicle.vehicleCode ?? vehicle.assetTag)?.trim();
  const makeModel = [vehicle.make, vehicle.vehicleModel ?? vehicle.model]
    .filter(Boolean)
    .join(" ")
    .trim();
  const name = vehicle.name?.trim();
  const parts = [reg, code, makeModel || name].filter(Boolean);
  return parts.length > 0 ? parts.join(" — ") : "Vehicle";
}

export function displayOperationalStatus(status?: string | null): string {
  const raw = String(status ?? "").trim();
  if (!raw) return "Status not set";
  return raw.replaceAll("_", " ");
}

export function isKnownJobDomain(value: unknown): value is JobDomain {
  return isJobDomain(value);
}
