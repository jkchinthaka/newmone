import type { FacilityDashboardBreakdownRow } from "./facility-dashboard-types";
import { formatNumber } from "./localization";

export type { FacilityDashboardBreakdownRow, PublicFacilityDashboardSummary } from "./facility-dashboard-types";
export { canViewFacilityReports } from "./facilities";

export function formatFacilityDashboardCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return formatNumber(value, { maximumFractionDigits: 0 });
}

export function hasFacilityDashboardData(summary: {
  hierarchy: { propertyCount: number; roomCount: number };
  issues: { totalIssueCount: number };
}): boolean {
  return (
    summary.hierarchy.propertyCount > 0 ||
    summary.hierarchy.roomCount > 0 ||
    summary.issues.totalIssueCount > 0
  );
}

export function breakdownHasRows(rows: readonly FacilityDashboardBreakdownRow[]): boolean {
  return rows.some((row) => row.count > 0);
}

export function facilityDashboardMetricUnavailable(label: string): string {
  return `${label} is not available yet`;
}
