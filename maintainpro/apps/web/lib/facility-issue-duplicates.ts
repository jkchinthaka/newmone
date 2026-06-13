import type { FacilityIssueCategory, FacilityIssueSeverity } from "./facility-issue-ui";

export type DuplicateIssueConfidence = "HIGH" | "MEDIUM" | "LOW";

export type DuplicateFacilityIssueCandidate = {
  id: string;
  title: string;
  descriptionPreview: string;
  status: string;
  category: FacilityIssueCategory | null;
  severity: FacilityIssueSeverity;
  roomName: string | null;
  locationName: string | null;
  createdAt: string;
  workOrderId: string | null;
  confidence: DuplicateIssueConfidence;
  reason: string;
};

export type DuplicateFacilityIssueCheckResult = {
  checkedAt: string;
  windowDays: number;
  candidates: DuplicateFacilityIssueCandidate[];
};

export const FACILITY_ISSUE_DUPLICATE_CHECK_PAYLOAD_KEYS = [
  "title",
  "description",
  "severity",
  "category",
  "locationId",
  "roomId"
] as const;

export function buildDuplicateFacilityIssueCheckPayload(input: {
  title: string;
  description?: string;
  severity?: string;
  locationId?: string;
  roomId?: string;
  category?: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    description: input.description?.trim() || undefined
  };

  if (input.severity?.trim()) {
    payload.severity = input.severity.trim();
  }

  if (input.locationId?.trim()) {
    payload.locationId = input.locationId.trim();
  }

  if (input.roomId?.trim()) {
    payload.roomId = input.roomId.trim();
  }

  if (input.category?.trim()) {
    payload.category = input.category.trim().toUpperCase();
  }

  return payload;
}

export function duplicateCheckPayloadIncludesTenantId(payload: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(payload, "tenantId");
}

export function duplicateCheckPayloadUsesAllowedKeysOnly(payload: Record<string, unknown>): boolean {
  return Object.keys(payload).every((key) =>
    FACILITY_ISSUE_DUPLICATE_CHECK_PAYLOAD_KEYS.includes(
      key as (typeof FACILITY_ISSUE_DUPLICATE_CHECK_PAYLOAD_KEYS)[number]
    )
  );
}

export function formatDuplicateIssueConfidenceLabel(confidence: DuplicateIssueConfidence): string {
  switch (confidence) {
    case "HIGH":
      return "High confidence";
    case "MEDIUM":
      return "Medium confidence";
    case "LOW":
      return "Low confidence";
    default:
      return confidence;
  }
}

export function duplicateIssueConfidenceTone(
  confidence: DuplicateIssueConfidence
): "danger" | "warning" | "info" {
  if (confidence === "HIGH") {
    return "danger";
  }

  if (confidence === "MEDIUM") {
    return "warning";
  }

  return "info";
}

export function getDuplicateIssueLocationLabel(candidate: DuplicateFacilityIssueCandidate): string {
  if (candidate.roomName) {
    return candidate.roomName;
  }

  if (candidate.locationName) {
    return candidate.locationName;
  }

  return "Unknown location";
}

export function shouldShowDuplicateIssueWarning(candidates: readonly DuplicateFacilityIssueCandidate[]): boolean {
  return candidates.length > 0;
}

export function duplicateIssueWarningHeadline(count: number): string {
  return count === 1
    ? "Possible duplicate issue found"
    : `${count} possible duplicate issues found`;
}

export function duplicateIssueCheckUnavailableMessage(): string {
  return "Duplicate check unavailable. You can still submit.";
}

export function duplicateIssueAllowsContinueDespiteWarning(): boolean {
  return true;
}
