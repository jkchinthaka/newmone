import type { FacilityAgeBucketRow, PublicFacilityAgingReport } from "./facility-aging-types";
import { formatFacilityDashboardCount } from "./facility-dashboard";

export type { FacilityAgeBucketRow, PublicFacilityAgingReport } from "./facility-aging-types";

export function hasFacilityAgingData(report: PublicFacilityAgingReport): boolean {
  return (
    report.issues.activeIssueCount > 0 ||
    report.workOrders.withDueDateCount > 0 ||
    report.issues.overdueIssueCount > 0
  );
}

export function agingBucketHasRows(rows: readonly FacilityAgeBucketRow[]): boolean {
  return rows.some((row) => row.count > 0);
}

export function formatAgingBucketHeatClass(count: number, maxCount: number): string {
  if (count <= 0 || maxCount <= 0) {
    return "bg-slate-50 text-slate-500";
  }

  const ratio = count / maxCount;
  if (ratio >= 0.75) {
    return "bg-rose-100 text-rose-900";
  }

  if (ratio >= 0.5) {
    return "bg-amber-100 text-amber-900";
  }

  if (ratio >= 0.25) {
    return "bg-yellow-50 text-yellow-900";
  }

  return "bg-emerald-50 text-emerald-900";
}

export function maxAgingBucketCount(rows: readonly FacilityAgeBucketRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.count), 0);
}

export function formatAgingMetric(value: number | null | undefined): string {
  return formatFacilityDashboardCount(value);
}
