/**
 * Documented KPI formulas. Historical meaning must not change via silent UI config.
 * Version bumps require explicit migration notes.
 */

export const KPI_FORMULA_VERSION = "2026-09-14.v1";

export type KpiDefinition = {
  key: string;
  label: string;
  domain: "GLOBAL" | "MACHINERY" | "FLEET" | "BUILDINGS" | "COMPLIANCE";
  formula: string;
  unit: string;
  help: string;
};

export const KPI_DEFINITIONS: KpiDefinition[] = [
  {
    key: "MTTR",
    label: "Mean Time To Repair",
    domain: "MACHINERY",
    formula: "sum(repairDurationHours) / count(completedCorrectiveWOs)",
    unit: "hours",
    help: "Average hours from WO start to completion for corrective work orders in the period."
  },
  {
    key: "MTBF",
    label: "Mean Time Between Failures",
    domain: "MACHINERY",
    formula: "operatingHours / count(failureEvents)",
    unit: "hours",
    help: "Operating hours divided by failure event count for the asset set in the period."
  },
  {
    key: "AVAILABILITY",
    label: "Availability",
    domain: "MACHINERY",
    formula: "(scheduledHours - downtimeHours) / scheduledHours",
    unit: "ratio",
    help: "Fraction of scheduled time the asset was available (not in downtime)."
  },
  {
    key: "DOWNTIME",
    label: "Downtime",
    domain: "MACHINERY",
    formula: "sum(completedAt - startedAt) for downtime-tagged WOs",
    unit: "hours",
    help: "Total downtime hours from work order start to completion where downtime is recorded."
  },
  {
    key: "PM_COMPLIANCE",
    label: "PM Compliance",
    domain: "GLOBAL",
    formula: "count(PM completed on/before due) / count(PM due in period)",
    unit: "ratio",
    help: "Share of preventive work completed on or before due date (grace excluded unless configured)."
  },
  {
    key: "COST_PER_KM",
    label: "Cost per km",
    domain: "FLEET",
    formula: "totalOperatingCost / distanceKm",
    unit: "currency/km",
    help: "Fleet operating cost divided by distance travelled in the period."
  },
  {
    key: "FUEL_EFFICIENCY",
    label: "Fuel efficiency",
    domain: "FLEET",
    formula: "distanceKm / litres",
    unit: "km/L",
    help: "Distance per litre from fuel logs paired with mileage."
  },
  {
    key: "SERVICE_COMPLIANCE",
    label: "Service compliance",
    domain: "FLEET",
    formula: "count(services on time) / count(services due)",
    unit: "ratio",
    help: "Fleet service jobs completed on or before due."
  },
  {
    key: "BACKLOG_AGE",
    label: "Backlog age",
    domain: "BUILDINGS",
    formula: "avg(now - createdAt) for open requests/WOs",
    unit: "days",
    help: "Average age of open facility/building work."
  },
  {
    key: "REPEAT_DEFECTS",
    label: "Repeat defects",
    domain: "BUILDINGS",
    formula: "count(assets with >=2 same issue in window)",
    unit: "count",
    help: "Assets with recurring identical issue codes in the lookback window."
  },
  {
    key: "COMPLIANCE_DUE",
    label: "Compliance due",
    domain: "COMPLIANCE",
    formula: "count(requirements with status DUE)",
    unit: "count",
    help: "Active compliance requirements inside reminder window before expiry."
  },
  {
    key: "COMPLIANCE_EXPIRED",
    label: "Compliance expired",
    domain: "COMPLIANCE",
    formula: "count(requirements with status EXPIRED)",
    unit: "count",
    help: "Active compliance requirements past grace period."
  },
  {
    key: "COMPLIANCE_COMPLETION",
    label: "Compliance completion rate",
    domain: "COMPLIANCE",
    formula: "count(renewed/completed) / count(due+expired+completed)",
    unit: "ratio",
    help: "Share of compliance items completed/renewed in the period."
  }
];

export function computeMttr(repairDurationsHours: number[]): number | null {
  if (!repairDurationsHours.length) return null;
  const sum = repairDurationsHours.reduce((a, b) => a + b, 0);
  return sum / repairDurationsHours.length;
}

export function computeMtbf(operatingHours: number, failureCount: number): number | null {
  if (!(operatingHours >= 0) || failureCount <= 0) return null;
  return operatingHours / failureCount;
}

export function computeAvailability(scheduledHours: number, downtimeHours: number): number | null {
  if (!(scheduledHours > 0)) return null;
  return (scheduledHours - Math.max(0, downtimeHours)) / scheduledHours;
}

export function computePmCompliance(completedOnTime: number, dueCount: number): number | null {
  if (!(dueCount > 0)) return null;
  return completedOnTime / dueCount;
}

export function getKpiDefinition(key: string): KpiDefinition | undefined {
  return KPI_DEFINITIONS.find((k) => k.key === key);
}
