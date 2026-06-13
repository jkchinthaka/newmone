import {
  FacilityIssueCategory,
  FacilityIssueStatus,
  IssueSeverity
} from "@prisma/client";

export type FacilityDashboardBreakdownRow = {
  key: string;
  label: string;
  count: number;
};

export type FacilityDashboardTopRoomRow = {
  roomId: string;
  roomName: string;
  openIssueCount: number;
};

export type FacilityDashboardIssuePreview = {
  id: string;
  title: string;
  severity: IssueSeverity;
  status: FacilityIssueStatus;
  category: FacilityIssueCategory | null;
  slaTargetAt: string | null;
  roomName: string | null;
  workOrderId: string | null;
  workOrderNumber: string | null;
  createdAt: string;
};

export type PublicFacilityDashboardSummary = {
  generatedAt: string;
  hierarchy: {
    propertyCount: number;
    buildingCount: number;
    floorCount: number;
    roomCount: number;
    inactiveRoomCount: number;
  };
  issues: {
    totalIssueCount: number;
    openIssueCount: number;
    inProgressIssueCount: number;
    resolvedIssueCount: number;
    closedIssueCount: number;
    overdueIssueCount: number;
    criticalOpenIssueCount: number;
    roomLinkedIssueCount: number;
    unlinkedIssueCount: number;
  };
  workOrderBridge: {
    linkedWorkOrderCount: number;
    unlinkedOpenIssueCount: number;
  };
  breakdowns: {
    byCategory: FacilityDashboardBreakdownRow[];
    bySeverity: FacilityDashboardBreakdownRow[];
    byStatus: FacilityDashboardBreakdownRow[];
  };
  attention: {
    topRoomsByOpenIssues: FacilityDashboardTopRoomRow[];
    overdueIssuesPreview: FacilityDashboardIssuePreview[];
    criticalIssuesPreview: FacilityDashboardIssuePreview[];
    unlinkedOpenIssuesPreview: FacilityDashboardIssuePreview[];
  };
};

const PUBLIC_DASHBOARD_KEYS = new Set<string>([
  "generatedAt",
  "hierarchy",
  "issues",
  "workOrderBridge",
  "breakdowns",
  "attention"
]);

const CATEGORY_LABELS: Record<FacilityIssueCategory, string> = {
  ELECTRICAL: "Electrical",
  PLUMBING: "Plumbing",
  CIVIL: "Civil",
  HVAC: "HVAC",
  SAFETY: "Safety",
  CLEANING: "Cleaning",
  PEST_CONTROL: "Pest control",
  OTHER: "Other"
};

export function formatCategoryBreakdownKey(
  category: FacilityIssueCategory | null
): FacilityDashboardBreakdownRow {
  if (!category) {
    return { key: "UNCATEGORIZED", label: "Uncategorized", count: 0 };
  }

  return {
    key: category,
    label: CATEGORY_LABELS[category] ?? category.replace(/_/g, " "),
    count: 0
  };
}

export function mapCategoryBreakdown(
  rows: Array<{ category: FacilityIssueCategory | null; _count: { _all: number } }>
): FacilityDashboardBreakdownRow[] {
  return rows
    .map((row) => {
      const base = formatCategoryBreakdownKey(row.category);
      return { ...base, count: row._count._all };
    })
    .sort((a, b) => b.count - a.count);
}

export function mapEnumBreakdown<T extends string>(
  rows: Array<{ key: T | null; _count: { _all: number } }>,
  labelFor: (key: T | null) => string
): FacilityDashboardBreakdownRow[] {
  return rows
    .map((row) => ({
      key: row.key ?? "UNKNOWN",
      label: labelFor(row.key),
      count: row._count._all
    }))
    .sort((a, b) => b.count - a.count);
}

type IssuePreviewGraph = {
  id: string;
  title: string;
  severity: IssueSeverity;
  status: FacilityIssueStatus;
  category: FacilityIssueCategory | null;
  slaTargetAt: Date | null;
  workOrderId: string | null;
  createdAt: Date;
  room?: { name: string } | null;
  workOrder?: { woNumber: string } | null;
};

export function toPublicFacilityIssuePreview(issue: IssuePreviewGraph): FacilityDashboardIssuePreview {
  return {
    id: issue.id,
    title: issue.title,
    severity: issue.severity,
    status: issue.status,
    category: issue.category,
    slaTargetAt: issue.slaTargetAt?.toISOString() ?? null,
    roomName: issue.room?.name ?? null,
    workOrderId: issue.workOrderId,
    workOrderNumber: issue.workOrder?.woNumber ?? null,
    createdAt: issue.createdAt.toISOString()
  };
}

export function publicFacilityDashboardHasSensitiveFields(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return Object.keys(record).some((key) => !PUBLIC_DASHBOARD_KEYS.has(key));
}

export function publicFacilityDashboardHasRawRelations(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const json = JSON.stringify(value);
  return /"room"\s*:\s*\{|"workOrder"\s*:\s*\{|"tenant"\s*:/.test(json);
}
