import { FacilityIssueStatus, IssueSeverity } from "@prisma/client";

import {
  toPublicFacilityIssuePreview,
  type FacilityDashboardIssuePreview
} from "./facility-dashboard.mapper";

export type FacilityAgeBucketKey = "0_1" | "2_3" | "4_7" | "8_plus";

export type FacilityAgeBucketRow = {
  key: FacilityAgeBucketKey;
  label: string;
  count: number;
  criticalCount: number;
  highCount: number;
};

export type FacilityWorkOrderAgingPreview = {
  id: string;
  woNumber: string;
  title: string;
  status: string;
  dueDate: string;
  ageDays: number;
  isOverdue: boolean;
  facilityIssueId: string | null;
};

export type PublicFacilityAgingReport = {
  generatedAt: string;
  issues: {
    activeIssueCount: number;
    overdueIssueCount: number;
    criticalHighActiveCount: number;
    ageBuckets: FacilityAgeBucketRow[];
    overduePreview: FacilityDashboardIssuePreview[];
    criticalHighAgingPreview: FacilityDashboardIssuePreview[];
  };
  workOrders: {
    trackingAvailable: boolean;
    linkedActiveCount: number;
    withDueDateCount: number;
    overdueCount: number;
    ageBuckets: FacilityAgeBucketRow[];
    overduePreview: FacilityWorkOrderAgingPreview[];
  };
};

export const FACILITY_AGE_BUCKET_ORDER: FacilityAgeBucketKey[] = ["0_1", "2_3", "4_7", "8_plus"];

export const FACILITY_AGE_BUCKET_LABELS: Record<FacilityAgeBucketKey, string> = {
  "0_1": "0–1 day",
  "2_3": "2–3 days",
  "4_7": "4–7 days",
  "8_plus": "8+ days"
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function calculateAgeDays(from: Date, now: Date): number {
  const elapsedMs = now.getTime() - from.getTime();
  return Math.max(0, Math.floor(elapsedMs / MS_PER_DAY));
}

export function resolveAgeBucketKey(ageDays: number): FacilityAgeBucketKey {
  if (ageDays <= 1) {
    return "0_1";
  }

  if (ageDays <= 3) {
    return "2_3";
  }

  if (ageDays <= 7) {
    return "4_7";
  }

  return "8_plus";
}

export function createEmptyAgeBuckets(): FacilityAgeBucketRow[] {
  return FACILITY_AGE_BUCKET_ORDER.map((key) => ({
    key,
    label: FACILITY_AGE_BUCKET_LABELS[key],
    count: 0,
    criticalCount: 0,
    highCount: 0
  }));
}

type IssueAgingInput = {
  createdAt: Date;
  severity: IssueSeverity;
  status: FacilityIssueStatus;
  slaTargetAt: Date | null;
};

export function accumulateIssueAgeBuckets(
  issues: readonly IssueAgingInput[],
  now: Date
): { buckets: FacilityAgeBucketRow[]; overdueCount: number; criticalHighActiveCount: number } {
  const buckets = createEmptyAgeBuckets();
  const bucketByKey = new Map(buckets.map((row) => [row.key, row]));
  let overdueCount = 0;
  let criticalHighActiveCount = 0;

  for (const issue of issues) {
    const ageDays = calculateAgeDays(issue.createdAt, now);
    const bucket = bucketByKey.get(resolveAgeBucketKey(ageDays));
    if (!bucket) {
      continue;
    }

    bucket.count += 1;

    if (issue.severity === IssueSeverity.CRITICAL) {
      bucket.criticalCount += 1;
      criticalHighActiveCount += 1;
    } else if (issue.severity === IssueSeverity.HIGH) {
      bucket.highCount += 1;
      criticalHighActiveCount += 1;
    }

    if (issue.slaTargetAt && issue.slaTargetAt.getTime() < now.getTime()) {
      overdueCount += 1;
    }
  }

  return { buckets, overdueCount, criticalHighActiveCount };
}

type WorkOrderAgingInput = {
  id: string;
  woNumber: string;
  title: string;
  status: string;
  dueDate: Date;
  createdAt: Date;
  facilityIssueId: string | null;
};

export function accumulateWorkOrderAgeBuckets(
  workOrders: readonly WorkOrderAgingInput[],
  now: Date
): {
  buckets: FacilityAgeBucketRow[];
  overdueCount: number;
  overduePreview: FacilityWorkOrderAgingPreview[];
} {
  const buckets = createEmptyAgeBuckets();
  const bucketByKey = new Map(buckets.map((row) => [row.key, row]));
  let overdueCount = 0;
  const overduePreview: FacilityWorkOrderAgingPreview[] = [];

  for (const workOrder of workOrders) {
    const ageDays = calculateAgeDays(workOrder.createdAt, now);
    const bucket = bucketByKey.get(resolveAgeBucketKey(ageDays));
    if (bucket) {
      bucket.count += 1;
    }

    const isOverdue = workOrder.dueDate.getTime() < now.getTime();
    if (isOverdue) {
      overdueCount += 1;
      overduePreview.push({
        id: workOrder.id,
        woNumber: workOrder.woNumber,
        title: workOrder.title,
        status: workOrder.status,
        dueDate: workOrder.dueDate.toISOString(),
        ageDays,
        isOverdue: true,
        facilityIssueId: workOrder.facilityIssueId
      });
    }
  }

  overduePreview.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return { buckets, overdueCount, overduePreview: overduePreview.slice(0, 5) };
}

type IssuePreviewGraph = Parameters<typeof toPublicFacilityIssuePreview>[0];

export function buildFacilityAgingReport(input: {
  now: Date;
  activeIssues: readonly IssuePreviewGraph[];
  overdueIssuesPreview: readonly IssuePreviewGraph[];
  criticalHighIssuesPreview: readonly IssuePreviewGraph[];
  workOrdersWithDueDate: readonly WorkOrderAgingInput[];
}): PublicFacilityAgingReport {
  const issueAccumulator = accumulateIssueAgeBuckets(
    input.activeIssues.map((issue) => ({
      createdAt: issue.createdAt,
      severity: issue.severity,
      status: issue.status,
      slaTargetAt: issue.slaTargetAt
    })),
    input.now
  );

  const workOrderAccumulator = accumulateWorkOrderAgeBuckets(input.workOrdersWithDueDate, input.now);

  return {
    generatedAt: input.now.toISOString(),
    issues: {
      activeIssueCount: input.activeIssues.length,
      overdueIssueCount: issueAccumulator.overdueCount,
      criticalHighActiveCount: issueAccumulator.criticalHighActiveCount,
      ageBuckets: issueAccumulator.buckets,
      overduePreview: input.overdueIssuesPreview.map(toPublicFacilityIssuePreview),
      criticalHighAgingPreview: input.criticalHighIssuesPreview.map(toPublicFacilityIssuePreview)
    },
    workOrders: {
      trackingAvailable: input.workOrdersWithDueDate.length > 0,
      linkedActiveCount: input.workOrdersWithDueDate.length,
      withDueDateCount: input.workOrdersWithDueDate.length,
      overdueCount: workOrderAccumulator.overdueCount,
      ageBuckets: workOrderAccumulator.buckets,
      overduePreview: workOrderAccumulator.overduePreview
    }
  };
}

const PUBLIC_AGING_KEYS = new Set<string>(["generatedAt", "issues", "workOrders"]);

export function publicFacilityAgingHasSensitiveFields(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return Object.keys(record).some((key) => !PUBLIC_AGING_KEYS.has(key));
}

export function publicFacilityAgingHasFakeMetricHelpers(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const json = JSON.stringify(value);
  return /placeholder|fake|sample|demo/i.test(json);
}
