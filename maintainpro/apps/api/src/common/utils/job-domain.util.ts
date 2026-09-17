/**
 * First-class maintenance job domains for the unified Work Order engine.
 * These are operational lanes (Machinery / Service / Vehicle), distinct from
 * AssetDomain taxonomy codes (PLANT_MACHINERY, FLEET, HVAC, …).
 */

export const JOB_DOMAINS = ["MACHINERY", "SERVICE", "VEHICLE"] as const;

export type JobDomain = (typeof JOB_DOMAINS)[number];

export const JOB_DOMAIN_LABELS: Record<JobDomain, string> = {
  MACHINERY: "Machinery",
  SERVICE: "Service",
  VEHICLE: "Vehicle"
};

/** AssetDomain.code values that map to MACHINERY jobs. */
const MACHINERY_DOMAIN_CODES = new Set([
  "PLANT_MACHINERY",
  "MECHANICAL",
  "ELECTRICAL",
  "UTILITIES",
  "HVAC_REFRIGERATION",
  "HVAC",
  "REFRIGERATION",
  "MATERIAL_HANDLING",
  "WATER_WASTEWATER",
  "ENERGY_SOLAR",
  "TOOLS_MOULDS_JIGS",
  "LABORATORY",
  "CALIBRATION",
  "OUTLET_EQUIPMENT",
  "FARM_INFRASTRUCTURE"
]);

/** AssetDomain.code values that map to SERVICE (facility) jobs. */
const SERVICE_DOMAIN_CODES = new Set([
  "FACILITY_CIVIL",
  "PLUMBING",
  "FIRE_SAFETY",
  "SECURITY",
  "IT_HARDWARE",
  "KITCHEN_CANTEEN",
  "EXTERNAL_INFRASTRUCTURE",
  "OTHER"
]);

const FLEET_DOMAIN_CODES = new Set(["FLEET"]);

export function isJobDomain(value: unknown): value is JobDomain {
  return typeof value === "string" && (JOB_DOMAINS as readonly string[]).includes(value);
}

export function parseJobDomain(value: unknown): JobDomain | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  return isJobDomain(normalized) ? normalized : undefined;
}

export function jobDomainLabel(value: string | null | undefined): string {
  const parsed = parseJobDomain(value);
  return parsed ? JOB_DOMAIN_LABELS[parsed] : value?.trim() || "—";
}

/**
 * Resolve the operational job domain for a work order / request.
 * Explicit jobDomain wins; otherwise infer from vehicle / asset domain code / placement.
 */
export function resolveJobDomain(input: {
  jobDomain?: string | null;
  vehicleId?: string | null;
  assetId?: string | null;
  assetDomainCode?: string | null;
}): JobDomain {
  const explicit = parseJobDomain(input.jobDomain);
  if (explicit) return explicit;

  if (input.vehicleId) return "VEHICLE";

  const code = input.assetDomainCode?.trim().toUpperCase() ?? "";
  if (code && FLEET_DOMAIN_CODES.has(code)) return "VEHICLE";
  if (code && MACHINERY_DOMAIN_CODES.has(code)) return "MACHINERY";
  if (code && SERVICE_DOMAIN_CODES.has(code)) return "SERVICE";

  // Location-only or unclassified facility work defaults to SERVICE.
  if (!input.assetId && !input.vehicleId) return "SERVICE";

  // Asset present but domain unknown — treat as machinery equipment work.
  if (input.assetId) return "MACHINERY";

  return "SERVICE";
}
