import {
  FacilityIssueCategory,
  FacilityIssueStatus,
  IssueSeverity,
  Priority,
  WorkOrderStatus
} from "@prisma/client";

export type WorkOrderActivityEntryType =
  | "work_order_created"
  | "work_started"
  | "work_completed"
  | "work_due"
  | "sla_deadline"
  | "facility_issue_reported"
  | "facility_issue_first_response"
  | "facility_issue_resolved"
  | "part_requested";

export type WorkOrderActivitySource = "work_order" | "facility_issue" | "system";

export type WorkOrderActivityEntry = {
  id: string;
  type: WorkOrderActivityEntryType;
  label: string;
  description: string | null;
  timestamp: string;
  actorName: string | null;
  severity: string | null;
  status: string | null;
  category: string | null;
  source: WorkOrderActivitySource;
  relatedId: string | null;
  relatedLabel: string | null;
};

export type WorkOrderLinkedFacilityIssueSummary = {
  id: string;
  title: string;
  descriptionPreview: string;
  category: FacilityIssueCategory | null;
  severity: IssueSeverity;
  status: FacilityIssueStatus;
  roomName: string | null;
  locationName: string | null;
  reportedAt: string;
};

export type WorkOrderActivityTimelineResult = {
  workOrderId: string;
  entries: WorkOrderActivityEntry[];
  linkedFacilityIssue: WorkOrderLinkedFacilityIssueSummary | null;
  checkedAt: string;
};

const PUBLIC_ACTIVITY_ENTRY_KEYS = new Set<string>([
  "id",
  "type",
  "label",
  "description",
  "timestamp",
  "actorName",
  "severity",
  "status",
  "category",
  "source",
  "relatedId",
  "relatedLabel"
]);

const PUBLIC_LINKED_ISSUE_KEYS = new Set<string>([
  "id",
  "title",
  "descriptionPreview",
  "category",
  "severity",
  "status",
  "roomName",
  "locationName",
  "reportedAt"
]);

const PUBLIC_TIMELINE_RESULT_KEYS = new Set<string>([
  "workOrderId",
  "entries",
  "linkedFacilityIssue",
  "checkedAt"
]);

type UserNameFields = {
  firstName: string;
  lastName: string;
};

type ActivityWorkOrderRecord = {
  id: string;
  tenantId: string | null;
  woNumber: string;
  title: string;
  status: WorkOrderStatus;
  priority: Priority;
  createdAt: Date;
  dueDate: Date | null;
  startDate: Date | null;
  completedDate: Date | null;
  slaDeadline: Date | null;
  createdBy: UserNameFields | null;
  technician: UserNameFields | null;
  facilityIssue: ActivityFacilityIssueRecord | null;
  partRequests: ActivityPartRequestRecord[];
};

type ActivityFacilityIssueRecord = {
  id: string;
  tenantId: string | null;
  title: string;
  description: string;
  category: FacilityIssueCategory | null;
  severity: IssueSeverity;
  status: FacilityIssueStatus;
  createdAt: Date;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  workOrderId: string | null;
  room: { name: string } | null;
  location: { name: string } | null;
  reportedBy: UserNameFields | null;
};

type ActivityPartRequestRecord = {
  id: string;
  createdAt: Date;
  status: string;
  requestedQuantity: number;
  part: { name: string; partNumber: string | null } | null;
  requestedBy: UserNameFields | null;
};

function formatUserName(user: UserNameFields | null | undefined): string | null {
  if (!user) {
    return null;
  }

  const fullName = `${user.firstName} ${user.lastName}`.trim();
  return fullName || null;
}

export function truncateActivityDescriptionPreview(description: string, maxLength = 160): string {
  const trimmed = description.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function pushEntry(
  entries: WorkOrderActivityEntry[],
  entry: WorkOrderActivityEntry
): void {
  entries.push(entry);
}

export function buildWorkOrderActivityTimeline(input: ActivityWorkOrderRecord): WorkOrderActivityTimelineResult {
  const entries: WorkOrderActivityEntry[] = [];
  const issue = input.facilityIssue;
  const issueTenantMatches =
    !issue?.tenantId || !input.tenantId || issue.tenantId === input.tenantId;
  const safeLinkedIssue =
    issue && issue.workOrderId === input.id && issueTenantMatches ? issue : null;

  if (safeLinkedIssue) {
    pushEntry(entries, {
      id: `${input.id}-issue-reported-${safeLinkedIssue.id}`,
      type: "facility_issue_reported",
      label: "Facility issue reported",
      description: safeLinkedIssue.title,
      timestamp: safeLinkedIssue.createdAt.toISOString(),
      actorName: formatUserName(safeLinkedIssue.reportedBy),
      severity: safeLinkedIssue.severity,
      status: safeLinkedIssue.status,
      category: safeLinkedIssue.category,
      source: "facility_issue",
      relatedId: safeLinkedIssue.id,
      relatedLabel: safeLinkedIssue.title
    });
  }

  pushEntry(entries, {
    id: `${input.id}-created`,
    type: "work_order_created",
    label: "Work order created",
    description: safeLinkedIssue
      ? `Work order ${input.woNumber} created from facility issue "${safeLinkedIssue.title}".`
      : `Work order ${input.woNumber} created.`,
    timestamp: input.createdAt.toISOString(),
    actorName: formatUserName(input.createdBy),
    severity: null,
    status: input.status,
    category: null,
    source: "work_order",
    relatedId: input.id,
    relatedLabel: input.woNumber
  });

  if (input.dueDate) {
    pushEntry(entries, {
      id: `${input.id}-due`,
      type: "work_due",
      label: "Due date scheduled",
      description: `Due date set for work order ${input.woNumber}.`,
      timestamp: input.dueDate.toISOString(),
      actorName: null,
      severity: null,
      status: input.status,
      category: null,
      source: "work_order",
      relatedId: input.id,
      relatedLabel: input.woNumber
    });
  }

  if (input.slaDeadline) {
    pushEntry(entries, {
      id: `${input.id}-sla`,
      type: "sla_deadline",
      label: "SLA deadline",
      description: `SLA target for priority ${input.priority}.`,
      timestamp: input.slaDeadline.toISOString(),
      actorName: null,
      severity: null,
      status: input.status,
      category: null,
      source: "system",
      relatedId: input.id,
      relatedLabel: input.woNumber
    });
  }

  if (input.startDate) {
    pushEntry(entries, {
      id: `${input.id}-started`,
      type: "work_started",
      label: "Work started",
      description: input.technician
        ? `Work started${formatUserName(input.technician) ? ` by ${formatUserName(input.technician)}` : ""}.`
        : "Work started.",
      timestamp: input.startDate.toISOString(),
      actorName: formatUserName(input.technician),
      severity: null,
      status: input.status,
      category: null,
      source: "work_order",
      relatedId: input.id,
      relatedLabel: input.woNumber
    });
  }

  for (const request of input.partRequests) {
    const partLabel = request.part?.partNumber
      ? `${request.part.name} (${request.part.partNumber})`
      : request.part?.name ?? "Part";

    pushEntry(entries, {
      id: `${input.id}-part-request-${request.id}`,
      type: "part_requested",
      label: "Part requested",
      description: `${partLabel} × ${request.requestedQuantity} (${request.status.replaceAll("_", " ")})`,
      timestamp: request.createdAt.toISOString(),
      actorName: formatUserName(request.requestedBy),
      severity: null,
      status: request.status,
      category: null,
      source: "work_order",
      relatedId: request.id,
      relatedLabel: partLabel
    });
  }

  if (safeLinkedIssue?.firstResponseAt) {
    pushEntry(entries, {
      id: `${input.id}-issue-first-response-${safeLinkedIssue.id}`,
      type: "facility_issue_first_response",
      label: "Facility issue first response",
      description: `First response recorded for "${safeLinkedIssue.title}".`,
      timestamp: safeLinkedIssue.firstResponseAt.toISOString(),
      actorName: null,
      severity: safeLinkedIssue.severity,
      status: safeLinkedIssue.status,
      category: safeLinkedIssue.category,
      source: "facility_issue",
      relatedId: safeLinkedIssue.id,
      relatedLabel: safeLinkedIssue.title
    });
  }

  if (input.completedDate) {
    pushEntry(entries, {
      id: `${input.id}-completed`,
      type: "work_completed",
      label: "Work completed",
      description: `Work order ${input.woNumber} marked completed.`,
      timestamp: input.completedDate.toISOString(),
      actorName: formatUserName(input.technician),
      severity: null,
      status: WorkOrderStatus.COMPLETED,
      category: null,
      source: "work_order",
      relatedId: input.id,
      relatedLabel: input.woNumber
    });
  }

  if (safeLinkedIssue?.resolvedAt) {
    pushEntry(entries, {
      id: `${input.id}-issue-resolved-${safeLinkedIssue.id}`,
      type: "facility_issue_resolved",
      label: "Facility issue resolved",
      description: `Issue "${safeLinkedIssue.title}" marked resolved.`,
      timestamp: safeLinkedIssue.resolvedAt.toISOString(),
      actorName: null,
      severity: safeLinkedIssue.severity,
      status: safeLinkedIssue.status,
      category: safeLinkedIssue.category,
      source: "facility_issue",
      relatedId: safeLinkedIssue.id,
      relatedLabel: safeLinkedIssue.title
    });
  }

  return {
    workOrderId: input.id,
    entries: sortWorkOrderActivityEntries(entries),
    linkedFacilityIssue: safeLinkedIssue
      ? {
          id: safeLinkedIssue.id,
          title: safeLinkedIssue.title,
          descriptionPreview: truncateActivityDescriptionPreview(safeLinkedIssue.description),
          category: safeLinkedIssue.category,
          severity: safeLinkedIssue.severity,
          status: safeLinkedIssue.status,
          roomName: safeLinkedIssue.room?.name ?? null,
          locationName: safeLinkedIssue.location?.name ?? null,
          reportedAt: safeLinkedIssue.createdAt.toISOString()
        }
      : null,
    checkedAt: new Date().toISOString()
  };
}

export function sortWorkOrderActivityEntries(entries: WorkOrderActivityEntry[]): WorkOrderActivityEntry[] {
  return [...entries].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  );
}

export function publicWorkOrderActivityEntryHasSensitiveFields(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.keys(value as Record<string, unknown>).some((key) => !PUBLIC_ACTIVITY_ENTRY_KEYS.has(key));
}

export function publicWorkOrderActivityEntryHasRawRelations(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return ["tenantId", "createdBy", "technician", "facilityIssue", "partRequests", "room", "location"].some(
    (key) => key in record
  );
}

export function publicWorkOrderActivityTimelineHasSensitiveFields(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return Object.keys(record).some((key) => !PUBLIC_TIMELINE_RESULT_KEYS.has(key));
}

export function publicLinkedFacilityIssueSummaryHasSensitiveFields(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.keys(value as Record<string, unknown>).some((key) => !PUBLIC_LINKED_ISSUE_KEYS.has(key));
}
