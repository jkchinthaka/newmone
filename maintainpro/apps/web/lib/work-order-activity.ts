export type EvidenceTimelineEventType =
  | "reported"
  | "assigned"
  | "started"
  | "photo_added"
  | "part_requested"
  | "completed"
  | "approved";

export type EvidenceTimelineEvent = {
  id: string;
  type: EvidenceTimelineEventType;
  label?: string;
  description?: string;
  occurredAt: string | Date;
  actorName?: string;
};

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
  category: string | null;
  severity: string;
  status: string;
  roomName: string | null;
  locationName: string | null;
  reportedAt: string;
};

export type WorkOrderActivityTimelineResponse = {
  workOrderId: string;
  entries: WorkOrderActivityEntry[];
  linkedFacilityIssue: WorkOrderLinkedFacilityIssueSummary | null;
  checkedAt: string;
};

const ACTIVITY_TO_EVIDENCE_TYPE: Record<WorkOrderActivityEntryType, EvidenceTimelineEventType> = {
  work_order_created: "reported",
  facility_issue_reported: "reported",
  work_started: "started",
  work_completed: "completed",
  work_due: "approved",
  sla_deadline: "approved",
  facility_issue_first_response: "assigned",
  facility_issue_resolved: "completed",
  part_requested: "part_requested"
};

export function mapWorkOrderActivityToEvidenceTimeline(
  entries: WorkOrderActivityEntry[]
): EvidenceTimelineEvent[] {
  return [...entries]
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
    .map((entry) => ({
      id: entry.id,
      type: ACTIVITY_TO_EVIDENCE_TYPE[entry.type],
      label: entry.label,
      description: buildActivityEventDescription(entry),
      occurredAt: entry.timestamp,
      actorName: entry.actorName ?? undefined
    }));
}

function buildActivityEventDescription(entry: WorkOrderActivityEntry): string | undefined {
  const parts: string[] = [];

  if (entry.description) {
    parts.push(entry.description);
  }

  const contextParts: string[] = [];
  if (entry.category) {
    contextParts.push(entry.category.replaceAll("_", " "));
  }
  if (entry.severity) {
    contextParts.push(`${entry.severity} severity`);
  }
  if (entry.status) {
    contextParts.push(entry.status.replaceAll("_", " "));
  }

  if (contextParts.length > 0) {
    parts.push(contextParts.join(" · "));
  }

  return parts.length > 0 ? parts.join(" — ") : undefined;
}

export function formatLinkedFacilityIssueLocation(
  issue: WorkOrderLinkedFacilityIssueSummary | null | undefined
): string | null {
  if (!issue) {
    return null;
  }

  if (issue.roomName && issue.locationName) {
    return `${issue.roomName} · ${issue.locationName}`;
  }

  return issue.roomName ?? issue.locationName ?? null;
}

export function buildFacilityIssueDetailHref(issueId: string | null | undefined): string | null {
  if (!issueId) {
    return null;
  }

  return `/cleaning/issues?issueId=${encodeURIComponent(issueId)}`;
}

export function workOrderActivityUnavailableMessage(): string {
  return "Activity timeline unavailable. Other work order actions remain available.";
}

export function workOrderActivityHasUploadActions(
  readiness?: { state?: string; uploadsEnabled?: boolean } | null
): boolean {
  return readiness?.state === "configured" && readiness?.uploadsEnabled === true;
}

export function workOrderActivityAllowsContinueWhenUnavailable(): boolean {
  return true;
}

export function shouldShowLinkedFacilityIssueSummary(
  issue: WorkOrderLinkedFacilityIssueSummary | null | undefined
): boolean {
  return Boolean(issue?.id);
}
