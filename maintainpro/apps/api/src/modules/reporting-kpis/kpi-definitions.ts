/**
 * Phase 13 — Centralized KPI Formula Registry
 *
 * All KPI formulas are defined here as immutable records. Formula meaning may
 * NOT be silently changed via UI configuration; changes require a version bump
 * and explicit migration note.
 *
 * Design decisions documented inline:
 *   - N/A ≠ 0: inapplicable KPIs (e.g. MTBF without meter data) return
 *     emptyBehavior "INSUFFICIENT_DATA", not zero. Displaying 0 would mislead.
 *   - Overdue is derived (dueAt < now AND status NOT in terminal set).
 *     Closed WOs with past due dates are NOT overdue — they were completed.
 *   - MTTR uses repair start/end (acknowledgedAt → completedAt) for the repair
 *     cycle, not WO creation time, to avoid inflating time spent waiting for
 *     approval or parts assignment.
 *   - Cost KPIs must use immutable cost snapshots captured at WO close, not
 *     live unit prices that may change post-close.
 */

export const KPI_FORMULA_VERSION = "2026-09-15.v1";

/** Terminal statuses: a WO in these states is never overdue, never in backlog. */
export const TERMINAL_WO_STATUSES = ["CLOSED", "CANCELLED"] as const;

export type KpiEmptyBehavior = "ZERO" | "NULL" | "INSUFFICIENT_DATA" | "NA";

export type KpiDefinition = {
  /** Canonical code used in API and permissions. */
  code: string;
  /** @deprecated alias of code — kept for back-compat with Phase 13 extract tests. */
  key: string;
  displayName: string;
  /** @deprecated alias of displayName. */
  label: string;
  description: string;
  /** Short tooltip text shown in UI next to KPI value. */
  formulaSummary: string;
  /** @deprecated alias of formulaSummary — kept for back-compat. */
  formula: string;
  numerator: string;
  denominator: string;
  /** Domain codes this KPI applies to, or ["*"] for all. */
  applicableDomains: string[];
  /** @deprecated legacy domain classifier. */
  domain: "GLOBAL" | "MACHINERY" | "FLEET" | "BUILDINGS" | "COMPLIANCE";
  unit: string;
  /**
   * What to return when there is no data or the KPI is inapplicable.
   * INSUFFICIENT_DATA means caller must show a warning, NOT zero.
   */
  emptyBehavior: KpiEmptyBehavior;
  sourceFields: string[];
  version: string;
  /** @deprecated alias of description. */
  help: string;
};

function def(
  code: string,
  displayName: string,
  description: string,
  formulaSummary: string,
  numerator: string,
  denominator: string,
  applicableDomains: string[],
  domain: KpiDefinition["domain"],
  unit: string,
  emptyBehavior: KpiEmptyBehavior,
  sourceFields: string[]
): KpiDefinition {
  return {
    code,
    key: code,
    displayName,
    label: displayName,
    description,
    formulaSummary,
    formula: formulaSummary,
    numerator,
    denominator,
    applicableDomains,
    domain,
    unit,
    emptyBehavior,
    sourceFields,
    version: KPI_FORMULA_VERSION,
    help: description
  };
}

export const KPI_DEFINITIONS: KpiDefinition[] = [
  def(
    "WO_OVERDUE",
    "Overdue Work Orders",
    "Count of non-terminal work orders whose due date is in the past. CLOSED or CANCELLED WOs with past due dates are excluded — they were completed and must not re-enter this count.",
    "count(WOs where dueAt < now AND status NOT IN terminal)",
    "WOs with dueAt < now AND status not in CLOSED/CANCELLED",
    "1",
    ["*"],
    "GLOBAL",
    "count",
    "ZERO",
    ["dueAt", "status"]
  ),
  def(
    "WO_BACKLOG",
    "Work Order Backlog",
    "Total count of non-terminal (open, in-progress, on-hold) work orders. CLOSED and CANCELLED are excluded.",
    "count(WOs where status NOT IN CLOSED/CANCELLED)",
    "WOs with status not in terminal set",
    "1",
    ["*"],
    "GLOBAL",
    "count",
    "ZERO",
    ["status"]
  ),
  def(
    "WO_BACKLOG_AGING",
    "Backlog Aging",
    "Distribution of non-terminal work orders by age buckets: <7 days, 7–30 days, 30–90 days, >90 days.",
    "buckets of (now - createdAt) for non-terminal WOs",
    "age of non-terminal WOs in days",
    "1",
    ["*"],
    "GLOBAL",
    "days",
    "NULL",
    ["createdAt", "status"]
  ),
  def(
    "PM_COMPLIANCE",
    "PM Compliance",
    "Percentage of preventive work orders completed on or before their due date. Cancelled PMs are excluded from both numerator and denominator — they were not a real obligation.",
    "onTimeCount / dueCount × 100",
    "PM WOs completed on or before dueAt (CLOSED within grace, not CANCELLED)",
    "PM WOs due in period (excluding CANCELLED)",
    ["*"],
    "GLOBAL",
    "%",
    "NULL",
    ["dueAt", "completedAt", "type", "status"]
  ),
  def(
    "PLANNED_VS_REACTIVE",
    "Planned vs Reactive",
    "Ratio of planned (PM/scheduled) work orders to reactive (corrective/emergency) work orders in the period.",
    "plannedCount / totalCount × 100",
    "WOs of type PREVENTIVE or SCHEDULED",
    "all non-cancelled WOs in period",
    ["*"],
    "GLOBAL",
    "%",
    "ZERO",
    ["type", "status", "createdAt"]
  ),
  def(
    "MTTR",
    "Mean Time To Repair",
    "Average hours from repair start (acknowledgedAt / startedAt) to repair completion for corrective work orders. Uses repair cycle only — creation-to-close inflates with approval/parts wait time. Invalid intervals (end <= start) are excluded.",
    "avg(repairCompletedAt − repairStartedAt) in hours for corrective WOs",
    "sum of valid repair durations in hours",
    "count of corrective WOs with valid start and end",
    ["PLANT_MACHINERY", "MECHANICAL", "ELECTRICAL", "HVAC", "HVAC_REFRIGERATION", "REFRIGERATION"],
    "MACHINERY",
    "hours",
    "NULL",
    ["repairStartedAt", "repairCompletedAt", "type"]
  ),
  def(
    "MTBF",
    "Mean Time Between Failures",
    "Operating hours divided by failure event count. Requires meter data (operating hours). Returns INSUFFICIENT_DATA — NOT zero — when operating hours are not available for the asset set, to avoid misleading low values.",
    "operatingHours / failureCount",
    "total operating hours in period",
    "failure event count (corrective WOs closed in period)",
    ["PLANT_MACHINERY", "MECHANICAL", "FLEET_VEHICLE"],
    "MACHINERY",
    "hours",
    "INSUFFICIENT_DATA",
    ["operatingHours", "failureCount"]
  ),
  def(
    "AVAILABILITY",
    "Availability",
    "Fraction of scheduled time the asset set was available (not in downtime). Requires scheduled hours.",
    "(scheduledHours − downtimeHours) / scheduledHours",
    "scheduledHours − downtimeHours",
    "scheduledHours",
    ["PLANT_MACHINERY", "MECHANICAL", "ELECTRICAL", "FLEET_VEHICLE"],
    "MACHINERY",
    "ratio",
    "NULL",
    ["scheduledHours", "downtimeHours"]
  ),
  def(
    "DOWNTIME",
    "Downtime",
    "Total downtime minutes from work order start to completion for downtime-tagged WOs.",
    "sum(end − start) in minutes for downtime-tagged WOs",
    "sum of downtimeMinutes across qualifying WOs",
    "1",
    ["PLANT_MACHINERY", "MECHANICAL", "ELECTRICAL", "UTILITIES"],
    "MACHINERY",
    "minutes",
    "ZERO",
    ["downtimeStart", "downtimeEnd", "downtimeMinutes"]
  ),
  def(
    "RESPONSE_TIME",
    "Response Time",
    "Average hours from issue reported (reportedAt) to first acknowledgement (acknowledgedAt).",
    "avg(acknowledgedAt − reportedAt) in hours",
    "sum of response durations in hours",
    "count of WOs with both reportedAt and acknowledgedAt",
    ["*"],
    "GLOBAL",
    "hours",
    "NULL",
    ["reportedAt", "acknowledgedAt"]
  ),
  def(
    "REPEAT_FAILURE",
    "Repeat Failure",
    "Count of asset+failure-code pairs that appear two or more times within the lookback window. High count signals inadequate root cause elimination.",
    "count(asset+failureCode pairs with ≥2 occurrences in windowDays)",
    "pairs with ≥2 corrective WOs on same asset+failure within window",
    "1",
    ["PLANT_MACHINERY", "MECHANICAL", "ELECTRICAL"],
    "MACHINERY",
    "count",
    "ZERO",
    ["assetId", "failureCode", "closedAt"]
  ),
  def(
    "MAINTENANCE_COST",
    "Maintenance Cost",
    "Sum of immutable cost snapshots captured at WO close. Uses snapshotTotal, not live unit prices, to prevent retroactive cost drift.",
    "sum(snapshotTotal) across closed WOs in period",
    "sum of snapshotTotal",
    "1",
    ["*"],
    "GLOBAL",
    "currency",
    "ZERO",
    ["snapshotTotal", "closedAt"]
  ),
  def(
    "COST_PER_KM",
    "Cost per KM",
    "Maintenance cost divided by distance (km) in the same period. Returns null when distance is zero or negative to avoid division-by-zero.",
    "maintenanceCost / distanceKm",
    "totalMaintenanceCost",
    "distanceKm (must be > 0)",
    ["FLEET_VEHICLE", "FLEET_LIGHT", "FLEET_HEAVY"],
    "FLEET",
    "currency/km",
    "NULL",
    ["snapshotTotal", "distanceKm"]
  ),
  def(
    "FLEET_SERVICE_COMPLIANCE",
    "Fleet Service Compliance",
    "Percentage of fleet service jobs completed on or before due date.",
    "onTimeServices / dueServices × 100",
    "fleet services completed on or before serviceDueAt",
    "fleet services due in period",
    ["FLEET_VEHICLE", "FLEET_LIGHT", "FLEET_HEAVY"],
    "FLEET",
    "%",
    "NULL",
    ["serviceDueAt", "serviceCompletedAt", "vehicleId"]
  ),
  def(
    "FUEL_EFFICIENCY",
    "Fuel Efficiency",
    "Distance per litre from fuel logs paired with mileage readings.",
    "distanceKm / litres",
    "distanceKm",
    "litres consumed",
    ["FLEET_VEHICLE", "FLEET_LIGHT", "FLEET_HEAVY"],
    "FLEET",
    "km/L",
    "NULL",
    ["distanceKm", "litres", "vehicleId"]
  ),
  def(
    "BUILDING_BACKLOG",
    "Building Backlog",
    "Count of open defects/requests for building and facility domains.",
    "count(open WOs/requests for FACILITY_CIVIL, BUILDING domains)",
    "open non-terminal WOs in facility/building domains",
    "1",
    ["FACILITY_CIVIL", "BUILDING", "FACILITY_OFFICE"],
    "BUILDINGS",
    "count",
    "ZERO",
    ["domainCode", "status"]
  ),
  def(
    "COMPLIANCE_RATE",
    "Compliance Rate",
    "Percentage of compliance items that are valid (not expired or due) out of total active items.",
    "validCount / totalCount × 100",
    "compliance items with status VALID/CURRENT",
    "all active compliance items",
    ["*"],
    "COMPLIANCE",
    "%",
    "NULL",
    ["complianceStatus", "expiryDate"]
  ),
  def(
    "COMPLIANCE_DUE",
    "Compliance Due",
    "Active compliance requirements inside reminder window before expiry.",
    "count(requirements with status DUE)",
    "compliance items with status DUE",
    "1",
    ["*"],
    "COMPLIANCE",
    "count",
    "ZERO",
    ["complianceStatus", "dueDate"]
  ),
  def(
    "COMPLIANCE_EXPIRED",
    "Compliance Expired",
    "Active compliance requirements past grace period.",
    "count(requirements with status EXPIRED)",
    "compliance items with status EXPIRED",
    "1",
    ["*"],
    "COMPLIANCE",
    "count",
    "ZERO",
    ["complianceStatus", "expiryDate"]
  )
];

// ──────────────────────────── Pure Compute Helpers ──────────────────────────
//
// All helpers are pure functions (no Prisma, no side-effects) so they can be
// unit-tested with exact fixture values.

/**
 * True when a WO status is terminal (CLOSED or CANCELLED).
 * Closed WOs with past due dates MUST NOT be counted as overdue.
 */
export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_WO_STATUSES as readonly string[]).includes(status.toUpperCase());
}

/**
 * Count of overdue work orders.
 * Overdue = dueAt < now AND status is NOT terminal.
 * Closed/cancelled WOs with past due dates are explicitly excluded.
 */
export function computeOverdueCount(
  wos: Array<{ dueAt: Date | null; status: string }>,
  now = new Date()
): number {
  return wos.filter(
    (wo) => wo.dueAt !== null && wo.dueAt < now && !isTerminalStatus(wo.status)
  ).length;
}

/**
 * Count of non-terminal (backlog) work orders.
 * CLOSED and CANCELLED are excluded.
 */
export function computeBacklogCount(wos: Array<{ status: string }>): number {
  return wos.filter((wo) => !isTerminalStatus(wo.status)).length;
}

/**
 * Backlog aging buckets.
 * Returns counts per bucket: lt7d, d7to30, d30to90, gt90d.
 */
export function computeBacklogAging(
  wos: Array<{ status: string; createdAt: Date }>,
  now = new Date()
): { lt7d: number; d7to30: number; d30to90: number; gt90d: number } {
  const result = { lt7d: 0, d7to30: 0, d30to90: 0, gt90d: 0 };
  for (const wo of wos) {
    if (isTerminalStatus(wo.status)) continue;
    const ageDays = (now.getTime() - wo.createdAt.getTime()) / 86_400_000;
    if (ageDays < 7) result.lt7d++;
    else if (ageDays < 30) result.d7to30++;
    else if (ageDays < 90) result.d30to90++;
    else result.gt90d++;
  }
  return result;
}

/**
 * PM Compliance percentage.
 * Cancelled PMs are excluded from both numerator and denominator.
 * Returns null when dueCount is 0 (no data, not 0%).
 */
export function computePmCompliance(completedOnTime: number, dueCount: number): number | null {
  if (!(dueCount > 0)) return null;
  return (completedOnTime / dueCount) * 100;
}

/**
 * Planned vs Reactive breakdown.
 * Returns planned count, reactive count, and planned percentage.
 */
export function computePlannedVsReactive(
  wos: Array<{ type: string; status: string }>
): { plannedCount: number; reactiveCount: number; plannedPct: number | null } {
  const nonCancelled = wos.filter((wo) => wo.status.toUpperCase() !== "CANCELLED");
  const plannedCount = nonCancelled.filter((wo) =>
    ["PREVENTIVE", "SCHEDULED", "PLANNED"].includes(wo.type.toUpperCase())
  ).length;
  const reactiveCount = nonCancelled.filter((wo) =>
    ["CORRECTIVE", "REACTIVE", "EMERGENCY"].includes(wo.type.toUpperCase())
  ).length;
  const total = nonCancelled.length;
  return {
    plannedCount,
    reactiveCount,
    plannedPct: total > 0 ? (plannedCount / total) * 100 : null
  };
}

/**
 * Mean Time To Repair in hours.
 * Uses repair start/end (not WO creation/close) to isolate the actual repair
 * cycle from approval + parts wait overhead.
 * Invalid intervals (end <= start or nulls) are excluded — they indicate data
 * quality issues, not zero-duration repairs.
 * Returns null when no valid durations exist.
 */
export function computeMttr(repairDurationsHours: number[]): number | null {
  const valid = repairDurationsHours.filter((d) => Number.isFinite(d) && d > 0);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Mean Time Between Failures in hours.
 * Returns null (emptyBehavior = INSUFFICIENT_DATA) when operatingHours is not
 * a positive finite number — this signals "insufficient data", not zero MTBF.
 * Returning 0 would be misleading and is explicitly forbidden.
 */
export function computeMtbf(
  operatingHours: number | null | undefined,
  failureCount: number
): number | null {
  if (operatingHours === null || operatingHours === undefined) return null;
  if (!Number.isFinite(operatingHours) || operatingHours <= 0) return null;
  if (failureCount <= 0) return null;
  return operatingHours / failureCount;
}

/**
 * Asset availability ratio (0–1).
 * Returns null when scheduledHours ≤ 0.
 */
export function computeAvailability(scheduledHours: number, downtimeHours: number): number | null {
  if (!(scheduledHours > 0)) return null;
  return (scheduledHours - Math.max(0, downtimeHours)) / scheduledHours;
}

/**
 * Total downtime in minutes.
 * Negative intervals are clamped to zero.
 */
export function computeDowntimeMinutes(
  intervals: Array<{ startMs: number; endMs: number }>
): number {
  return intervals.reduce((sum, { startMs, endMs }) => sum + Math.max(0, endMs - startMs), 0) / 60_000;
}

/**
 * Average response time in hours.
 * Returns null when no valid (acknowledgedAt - reportedAt) pairs exist.
 */
export function computeResponseTimeHours(
  pairs: Array<{ reportedAt: Date; acknowledgedAt: Date }>
): number | null {
  const valid = pairs
    .map(({ reportedAt, acknowledgedAt }) => (acknowledgedAt.getTime() - reportedAt.getTime()) / 3_600_000)
    .filter((h) => Number.isFinite(h) && h >= 0);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Repeat failure count: asset+failureCode pairs with ≥2 occurrences within windowDays.
 */
export function computeRepeatFailures(
  events: Array<{ assetId: string; failureCode: string; occurredAt: Date }>,
  windowDays: number,
  now = new Date()
): number {
  const cutoff = new Date(now.getTime() - windowDays * 86_400_000);
  const inWindow = events.filter((e) => e.occurredAt >= cutoff);
  const counts = new Map<string, number>();
  for (const e of inWindow) {
    const key = `${e.assetId}|${e.failureCode}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].filter((c) => c >= 2).length;
}

/**
 * Maintenance cost from immutable snapshots.
 * Never uses live unit prices — they may change after WO close.
 */
export function computeMaintenanceCost(snapshotTotals: number[]): number {
  return snapshotTotals.reduce((a, b) => a + b, 0);
}

/**
 * Cost per KM.
 * Returns null when distanceKm ≤ 0 to avoid division-by-zero confusion.
 * Null explicitly means "insufficient distance data", not zero cost.
 */
export function computeCostPerKm(
  maintenanceCost: number,
  distanceKm: number
): number | null {
  if (!(distanceKm > 0)) return null;
  return maintenanceCost / distanceKm;
}

/**
 * Fleet service compliance percentage.
 * Returns null when dueServices is 0.
 */
export function computeFleetServiceCompliance(
  onTimeServices: number,
  dueServices: number
): number | null {
  if (!(dueServices > 0)) return null;
  return (onTimeServices / dueServices) * 100;
}

/**
 * Compliance rate percentage.
 * Returns null when total is 0.
 */
export function computeComplianceRate(validCount: number, totalCount: number): number | null {
  if (!(totalCount > 0)) return null;
  return (validCount / totalCount) * 100;
}

// ──────────────────────────── Registry Helpers ──────────────────────────────

export function getKpiDefinition(codeOrKey: string): KpiDefinition | undefined {
  const upper = codeOrKey.toUpperCase();
  return KPI_DEFINITIONS.find((k) => k.code === upper || k.key === upper);
}

export function listKpiDefinitions(): KpiDefinition[] {
  return KPI_DEFINITIONS;
}

/**
 * Check whether a KPI code applies to a given domain code.
 * Uses domain-profiles' kpiKeys or the definition's applicableDomains.
 */
export function isKpiApplicableForDomain(kpiCode: string, domainCode: string): boolean {
  const def = getKpiDefinition(kpiCode);
  if (!def) return false;
  if (def.applicableDomains.includes("*")) return true;
  return def.applicableDomains.some(
    (d) => d.toUpperCase() === domainCode.toUpperCase()
  );
}
