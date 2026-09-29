import { BadRequestException } from "@nestjs/common";
import { MaintenanceRequestStatus } from "@prisma/client";

const ACTIVE_STATUSES: MaintenanceRequestStatus[] = [
  MaintenanceRequestStatus.NEW,
  MaintenanceRequestStatus.UNDER_REVIEW,
  MaintenanceRequestStatus.NEEDS_INFORMATION,
  MaintenanceRequestStatus.APPROVED
];

/** Pre-work-order queue. Approved requests wait for conversion and stay on All Requests. */
export const TRIAGE_QUEUE_STATUSES: MaintenanceRequestStatus[] = [
  MaintenanceRequestStatus.NEW,
  MaintenanceRequestStatus.UNDER_REVIEW,
  MaintenanceRequestStatus.NEEDS_INFORMATION
];

const PRIORITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3
};

/** Critical first, then older reports within the same priority. */
export function compareTriageOrder(
  a: { priority: string; reportedAt: Date },
  b: { priority: string; reportedAt: Date }
) {
  const rank = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
  if (rank !== 0) return rank;
  return a.reportedAt.getTime() - b.reportedAt.getTime();
}

export function isActiveRequestStatus(status: MaintenanceRequestStatus) {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Named request stages shared by the summary counters and the list filter, so a counter
 * and the list it links to always use the same status predicate.
 */
export const REQUEST_STAGES = ["open", "awaiting_triage", "urgent", "converted"] as const;
export type RequestStage = (typeof REQUEST_STAGES)[number];

export function requestStageFilter(stage: RequestStage): {
  statuses: MaintenanceRequestStatus[];
  priorities?: string[];
} {
  switch (stage) {
    case "open":
      return { statuses: [...ACTIVE_STATUSES] };
    case "awaiting_triage":
      return { statuses: [...TRIAGE_QUEUE_STATUSES] };
    case "urgent":
      return { statuses: [...ACTIVE_STATUSES], priorities: ["HIGH", "CRITICAL"] };
    case "converted":
      return { statuses: [MaintenanceRequestStatus.CONVERTED_TO_WO] };
  }
}

/** What the acting user is permitted to do on requests in general (DB-resolved permissions). */
export type RequestCapabilities = {
  canReport: boolean;
  canTriage: boolean;
  canApprove: boolean;
  canReject: boolean;
  canConvert: boolean;
  /** Endpoint gate for every cancel (owner or reviewer). */
  canCancelOwn: boolean;
  canCancelAny: boolean;
};

export type RequestActionKey =
  | "startReview"
  | "triage"
  | "requestInformation"
  | "respond"
  | "resumeReview"
  | "approve"
  | "close"
  | "markDuplicate"
  | "convert"
  | "cancel";

/**
 * `allowed` — the action will be accepted by the API right now.
 * `reason` — set when the action applies to this status and role but is blocked; the UI
 * shows it instead of offering a button that would fail.
 */
export type RequestActionState = { allowed: boolean; reason?: string };

const SELF_GOVERNED_REASON =
  "Segregation of duties: you reported this request, so another reviewer must handle it.";
const TARGET_UNRESOLVED_REASON =
  "Confirm the machine, vehicle, or functional location in triage first.";

/**
 * Single source of truth for which request actions are available. The service enforces
 * the same rules on each mutation; the UI renders buttons from this result.
 */
export function requestAllowedActions(
  request: {
    status: MaintenanceRequestStatus;
    isOwner: boolean;
    targetUnresolved: boolean;
    hasTarget: boolean;
    workOrderId: string | null;
  },
  caps: RequestCapabilities
): Record<RequestActionKey, RequestActionState> {
  const { status, isOwner } = request;
  const targetReady = !request.targetUnresolved && request.hasTarget;

  const governed = (permitted: boolean, statusOk: boolean, blockedReason?: string) => {
    if (!permitted || !statusOk) return { allowed: false };
    if (isOwner) return { allowed: false, reason: SELF_GOVERNED_REASON };
    if (blockedReason) return { allowed: false, reason: blockedReason };
    return { allowed: true };
  };

  let cancel: RequestActionState = { allowed: false };
  if (canTransition(status, MaintenanceRequestStatus.CANCELLED) && caps.canCancelOwn) {
    if (!isOwner) {
      cancel = { allowed: caps.canCancelAny || caps.canTriage };
    } else if (caps.canCancelAny || status === MaintenanceRequestStatus.NEW) {
      cancel = { allowed: true };
    } else {
      cancel = {
        allowed: false,
        reason: "Review has started, so ask the reviewer to cancel this request."
      };
    }
  }

  return {
    startReview: governed(caps.canTriage, status === MaintenanceRequestStatus.NEW),
    triage: governed(
      caps.canTriage,
      status === MaintenanceRequestStatus.NEW ||
        status === MaintenanceRequestStatus.UNDER_REVIEW ||
        status === MaintenanceRequestStatus.APPROVED
    ),
    requestInformation: governed(
      caps.canTriage,
      canTransition(status, MaintenanceRequestStatus.NEEDS_INFORMATION)
    ),
    respond: {
      allowed: isOwner && caps.canReport && status === MaintenanceRequestStatus.NEEDS_INFORMATION
    },
    resumeReview: governed(caps.canTriage, status === MaintenanceRequestStatus.NEEDS_INFORMATION),
    approve: governed(
      caps.canApprove,
      canTransition(status, MaintenanceRequestStatus.APPROVED),
      targetReady ? undefined : TARGET_UNRESOLVED_REASON
    ),
    close: governed(caps.canReject, canTransition(status, MaintenanceRequestStatus.CLOSED)),
    markDuplicate: governed(caps.canTriage, canTransition(status, MaintenanceRequestStatus.CLOSED)),
    convert: governed(
      caps.canConvert,
      status === MaintenanceRequestStatus.APPROVED && !request.workOrderId,
      targetReady ? undefined : TARGET_UNRESOLVED_REASON
    ),
    cancel
  };
}

function canTransition(from: MaintenanceRequestStatus, to: MaintenanceRequestStatus) {
  return (REQUEST_TRANSITIONS[from] ?? []).includes(to);
}

const REQUEST_TRANSITIONS: Record<MaintenanceRequestStatus, MaintenanceRequestStatus[]> = {
  NEW: [
    MaintenanceRequestStatus.UNDER_REVIEW,
    MaintenanceRequestStatus.CANCELLED,
    MaintenanceRequestStatus.CLOSED
  ],
  UNDER_REVIEW: [
    MaintenanceRequestStatus.NEEDS_INFORMATION,
    MaintenanceRequestStatus.APPROVED,
    MaintenanceRequestStatus.CLOSED,
    MaintenanceRequestStatus.CANCELLED
  ],
  NEEDS_INFORMATION: [
    MaintenanceRequestStatus.UNDER_REVIEW,
    MaintenanceRequestStatus.CANCELLED,
    MaintenanceRequestStatus.CLOSED
  ],
  APPROVED: [MaintenanceRequestStatus.CONVERTED_TO_WO, MaintenanceRequestStatus.CANCELLED],
  REJECTED: [],
  CANCELLED: [],
  CLOSED: [],
  CONVERTED_TO_WO: []
};

export function assertValidTransition(
  from: MaintenanceRequestStatus,
  to: MaintenanceRequestStatus
) {
  if (!canTransition(from, to)) {
    throw new BadRequestException(`Illegal status transition: ${from} → ${to}`);
  }
}

export const DEFAULT_PROBLEM_CATEGORIES = [
  { code: "ELECTRICAL", name: "Electrical", sortOrder: 10 },
  { code: "MECHANICAL", name: "Mechanical", sortOrder: 20 },
  { code: "LEAK", name: "Leak", sortOrder: 30 },
  { code: "NO_POWER", name: "No Power", sortOrder: 40 },
  { code: "ABNORMAL_NOISE", name: "Abnormal Noise", sortOrder: 50 },
  { code: "TEMPERATURE", name: "Temperature", sortOrder: 60 },
  { code: "STRUCTURAL", name: "Structural", sortOrder: 70 },
  { code: "PLUMBING", name: "Plumbing", sortOrder: 80 },
  { code: "SAFETY", name: "Safety", sortOrder: 90 },
  { code: "VEHICLE", name: "Vehicle", sortOrder: 100 },
  { code: "OTHER", name: "Other", sortOrder: 999 }
] as const;

export function humanRequestStatus(status: MaintenanceRequestStatus): string {
  const labels: Record<MaintenanceRequestStatus, string> = {
    NEW: "New",
    UNDER_REVIEW: "Under Review",
    NEEDS_INFORMATION: "Needs Information",
    APPROVED: "Accepted",
    REJECTED: "Rejected (legacy)",
    CANCELLED: "Cancelled",
    CLOSED: "Closed",
    CONVERTED_TO_WO: "Converted to Work Order"
  };
  return labels[status] ?? status;
}

export function mapRejectionTypeToResolution(reasonType: string | null | undefined): string {
  switch (reasonType) {
    case "DUPLICATE":
      return "DUPLICATE";
    case "NOT_MAINTENANCE":
      return "NOT_MAINTENANCE";
    case "INVALID_REQUEST":
      return "INVALID";
    case "ALREADY_RESOLVED":
      return "RESOLVED_WITHOUT_WO";
    default:
      return "INVALID";
  }
}
