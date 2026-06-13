import {
  FacilityIssueCategory,
  FacilityIssueStatus,
  IssueSeverity
} from "@prisma/client";

export type DuplicateIssueConfidence = "HIGH" | "MEDIUM" | "LOW";

export type DuplicateFacilityIssueCandidate = {
  id: string;
  title: string;
  descriptionPreview: string;
  status: FacilityIssueStatus;
  category: FacilityIssueCategory | null;
  severity: IssueSeverity;
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

export const DUPLICATE_ISSUE_MAX_CANDIDATES = 5;
export const DUPLICATE_ISSUE_DEFAULT_WINDOW_DAYS = 7;
export const DUPLICATE_ISSUE_MIN_WINDOW_DAYS = 1;
export const DUPLICATE_ISSUE_MAX_WINDOW_DAYS = 90;
export const DUPLICATE_ISSUE_STRONG_TEXT_OVERLAP = 0.5;
export const DUPLICATE_ISSUE_WEAK_TEXT_OVERLAP = 0.25;
export const DUPLICATE_ISSUE_MIN_SHARED_TOKENS = 2;

const PUBLIC_DUPLICATE_CANDIDATE_KEYS = new Set<string>([
  "id",
  "title",
  "descriptionPreview",
  "status",
  "category",
  "severity",
  "roomName",
  "locationName",
  "createdAt",
  "workOrderId",
  "confidence",
  "reason"
]);

export function normalizeDuplicateIssueText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeDuplicateIssueText(value: string | null | undefined): string[] {
  const normalized = normalizeDuplicateIssueText(value);
  if (!normalized) {
    return [];
  }

  return normalized.split(" ").filter((token) => token.length >= 2);
}

export function computeDuplicateTextOverlapScore(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  const leftTokens = new Set(tokenizeDuplicateIssueText(left));
  const rightTokens = new Set(tokenizeDuplicateIssueText(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  }

  return shared / Math.min(leftTokens.size, rightTokens.size);
}

export function computeDuplicateCombinedTextScore(input: {
  title: string;
  description?: string | null;
  candidateTitle: string;
  candidateDescription: string;
}): number {
  const inputCombined = `${input.title} ${input.description ?? ""}`.trim();
  const candidateCombined = `${input.candidateTitle} ${input.candidateDescription}`.trim();

  return Math.max(
    computeDuplicateTextOverlapScore(input.title, input.candidateTitle),
    computeDuplicateTextOverlapScore(input.description, input.candidateDescription),
    computeDuplicateTextOverlapScore(inputCombined, candidateCombined)
  );
}

export function countSharedDuplicateTokens(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  const leftTokens = new Set(tokenizeDuplicateIssueText(left));
  const rightTokens = tokenizeDuplicateIssueText(right);
  return rightTokens.filter((token) => leftTokens.has(token)).length;
}

export function hasStrongDuplicateTextOverlap(score: number, sharedTokens: number): boolean {
  return score >= DUPLICATE_ISSUE_STRONG_TEXT_OVERLAP || sharedTokens >= 3;
}

export function hasWeakDuplicateTextOverlap(score: number, sharedTokens: number): boolean {
  return score >= DUPLICATE_ISSUE_WEAK_TEXT_OVERLAP || sharedTokens >= DUPLICATE_ISSUE_MIN_SHARED_TOKENS;
}

export function resolveDuplicateIssueConfidence(input: {
  inputCategory?: FacilityIssueCategory | null;
  candidateCategory: FacilityIssueCategory | null;
  textScore: number;
  sharedTokens: number;
}): { confidence: DuplicateIssueConfidence; reason: string } | null {
  const categoryMatch =
    Boolean(input.inputCategory) &&
    Boolean(input.candidateCategory) &&
    input.inputCategory === input.candidateCategory;
  const strongText = hasStrongDuplicateTextOverlap(input.textScore, input.sharedTokens);
  const weakText = hasWeakDuplicateTextOverlap(input.textScore, input.sharedTokens);

  if (categoryMatch && strongText) {
    return {
      confidence: "HIGH",
      reason: "Same location with matching category and similar title/description text"
    };
  }

  if (categoryMatch) {
    return {
      confidence: "MEDIUM",
      reason: "Same location with matching category and a recent open issue"
    };
  }

  if (weakText) {
    return {
      confidence: "LOW",
      reason: "Same location with similar title/description text"
    };
  }

  return null;
}

export function clampDuplicateIssueWindowDays(value: number | undefined): number {
  if (value == null || Number.isNaN(value)) {
    return DUPLICATE_ISSUE_DEFAULT_WINDOW_DAYS;
  }

  return Math.min(
    DUPLICATE_ISSUE_MAX_WINDOW_DAYS,
    Math.max(DUPLICATE_ISSUE_MIN_WINDOW_DAYS, Math.floor(value))
  );
}

export function truncateDuplicateDescriptionPreview(description: string, maxLength = 160): string {
  const trimmed = description.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1)}…`;
}

type DuplicateCandidateGraph = {
  id: string;
  title: string;
  description: string;
  status: FacilityIssueStatus;
  category: FacilityIssueCategory | null;
  severity: IssueSeverity;
  workOrderId: string | null;
  createdAt: Date;
  location?: { name: string } | null;
  room?: { name: string } | null;
};

export function toPublicDuplicateFacilityIssueCandidate(
  issue: DuplicateCandidateGraph,
  confidence: DuplicateIssueConfidence,
  reason: string
): DuplicateFacilityIssueCandidate {
  return {
    id: issue.id,
    title: issue.title,
    descriptionPreview: truncateDuplicateDescriptionPreview(issue.description),
    status: issue.status,
    category: issue.category,
    severity: issue.severity,
    roomName: issue.room?.name ?? null,
    locationName: issue.location?.name ?? null,
    createdAt: issue.createdAt.toISOString(),
    workOrderId: issue.workOrderId,
    confidence,
    reason
  };
}

export function sortDuplicateFacilityIssueCandidates(
  candidates: DuplicateFacilityIssueCandidate[]
): DuplicateFacilityIssueCandidate[] {
  const rank: Record<DuplicateIssueConfidence, number> = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1
  };

  return [...candidates].sort((left, right) => {
    const confidenceDelta = rank[right.confidence] - rank[left.confidence];
    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

export function publicDuplicateFacilityIssueCandidateHasSensitiveFields(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return Object.keys(record).some((key) => !PUBLIC_DUPLICATE_CANDIDATE_KEYS.has(key));
}

export function publicDuplicateFacilityIssueCandidateHasRawRelations(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const json = JSON.stringify(value);
  return /"room"\s*:\s*\{|"location"\s*:\s*\{|"workOrder"\s*:\s*\{|"tenant"\s*:/.test(json);
}
