/**
 * Display rules for Maintenance Requests. Pure functions (no React / network) so the
 * list and detail pages share one vocabulary and the rules are unit-testable.
 */
import type {
  MaintenanceRequestSummary,
  RequestActionKey,
  RequestAllowedActions,
  RequestStage
} from "./maintenance-requests-api";

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  UNDER_REVIEW: "Under Review",
  NEEDS_INFORMATION: "Needs Information",
  APPROVED: "Accepted",
  REJECTED: "Rejected",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
  CONVERTED_TO_WO: "Converted to Work Order"
};

const HISTORY_ACTION_LABELS: Record<string, string> = {
  CREATED: "Request reported",
  START_REVIEW: "Review started",
  TRIAGE_UPDATE: "Triage updated",
  NEEDS_INFORMATION: "More information requested",
  REQUESTER_RESPONDED: "Requester responded",
  RESUME_REVIEW: "Review resumed",
  APPROVED: "Accepted for work",
  CLOSED: "Closed without work order",
  MARKED_DUPLICATE: "Closed as duplicate",
  CANCELLED: "Cancelled",
  CONVERTED_TO_WO: "Work order created"
};

const RESOLUTION_LABELS: Record<string, string> = {
  DUPLICATE: "Duplicate of an existing request",
  NOT_MAINTENANCE: "Not a maintenance issue",
  INVALID: "Invalid request",
  RESOLVED_WITHOUT_WO: "Resolved without a work order"
};

const VALUE_LABELS: Record<string, string> = {
  NORMAL: "Normal",
  URGENT: "Urgent",
  VERY_URGENT: "Very urgent",
  YES: "Yes",
  NO: "No",
  NOT_SURE: "Not sure",
  NONE: "None",
  REDUCED: "Reduced",
  STOPPED: "Stopped",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
  MACHINERY: "Machinery",
  SERVICE: "Service / Facility",
  VEHICLE: "Vehicle"
};

function titleCase(code: string) {
  return code
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function requestStatusLabel(status: string | null | undefined) {
  if (!status) return "—";
  return STATUS_LABELS[status] ?? titleCase(status);
}

/**
 * Requester-facing progress. These are labels only. Converted does not mean the
 * physical work is finished; that follows the linked work order status.
 */
export function requesterFacingStatus(
  status: string | null | undefined,
  workOrderStatus?: string | null
) {
  switch (status) {
    case "NEW":
      return "Submitted";
    case "UNDER_REVIEW":
      return "Under Review";
    case "NEEDS_INFORMATION":
      return "More Information Needed";
    case "APPROVED":
      return "Accepted / Scheduled";
    case "REJECTED":
    case "CLOSED":
      return "Closed Without Work";
    case "CANCELLED":
      return "Cancelled";
    case "CONVERTED_TO_WO":
      return convertedWorkProgress(workOrderStatus);
    default:
      return requestStatusLabel(status);
  }
}

export const REQUEST_TRACKER_LABELS = ["Submitted", "Approved", "In progress", "Done"] as const;

/** Index of the current step on Submitted → Approved → In progress → Done. */
export function requestTrackerIndex(
  status: string | null | undefined,
  workOrderStatus?: string | null
) {
  const request = (status ?? "").toUpperCase();
  const workOrder = (workOrderStatus ?? "").toUpperCase();
  if (request === "REJECTED" || request === "CANCELLED" || workOrder === "CANCELLED") return 0;
  if (workOrder === "COMPLETED" || workOrder === "CLOSED" || workOrder === "VERIFIED") return 3;
  if (request === "CLOSED") return 3;
  if (
    workOrder === "IN_PROGRESS" ||
    workOrder === "ON_HOLD" ||
    workOrder === "OVERDUE" ||
    workOrder === "REWORK_REQUIRED" ||
    workOrder === "TECHNICIAN_COMPLETED"
  ) {
    return 2;
  }
  if (request === "APPROVED" || request === "CONVERTED_TO_WO" || workOrder.length > 0) return 1;
  return 0;
}

function convertedWorkProgress(workOrderStatus?: string | null) {
  switch (workOrderStatus) {
    case "IN_PROGRESS":
    case "ON_HOLD":
    case "OVERDUE":
    case "REWORK_REQUIRED":
      return "Maintenance In Progress";
    case "TECHNICIAN_COMPLETED":
      return "Work Done — Awaiting Verification";
    case "VERIFIED":
    case "COMPLETED":
    case "CLOSED":
      return "Resolved / Completed";
    case "CANCELLED":
      return "Closed Without Work";
    default:
      return "Accepted / Scheduled";
  }
}

/** Matches the API triage queue: New, Under Review, Needs Information. Accepted stays on All requests. */
export function requestTriageExplanation() {
  return "New, Under Review, and Needs Information. Accepted requests stay on All requests until a work order is created.";
}

export function requestHistoryActionLabel(action: string | null | undefined) {
  if (!action) return "Update";
  return HISTORY_ACTION_LABELS[action] ?? titleCase(action);
}

export function requestResolutionLabel(code: string | null | undefined) {
  if (!code) return null;
  return RESOLUTION_LABELS[code] ?? titleCase(code);
}

/** Business label for enum-like values (urgency, impact, priority, job domain). */
export function requestValueLabel(value: string | null | undefined) {
  if (!value) return "—";
  return VALUE_LABELS[value] ?? titleCase(value);
}

export function isActionAllowed(actions: RequestAllowedActions | undefined, key: RequestActionKey) {
  return Boolean(actions?.[key]?.allowed);
}

/** The reason an applicable action is blocked, if the server gave one. */
export function actionBlockedReason(actions: RequestAllowedActions | undefined, key: RequestActionKey) {
  const state = actions?.[key];
  return state && !state.allowed ? state.reason ?? null : null;
}

export type RequestNextStep = {
  tone: "info" | "waiting" | "done" | "blocked";
  title: string;
  detail: string;
};

/**
 * What happens next and who is responsible, from the viewer's perspective. Uses the
 * server-computed actions so "you can do X" is only said when the API will accept it.
 */
export function requestNextStep(request: {
  status: string;
  targetUnresolved?: boolean | null;
  workOrder?: { woNumber: string; status?: string | null } | null;
  allowedActions?: RequestAllowedActions;
  isOwner: boolean;
}): RequestNextStep {
  const actions = request.allowedActions;
  switch (request.status) {
    case "NEW":
      return isActionAllowed(actions, "startReview")
        ? { tone: "info", title: "Ready for triage", detail: "Start the review to confirm the target and priority." }
        : {
            tone: "waiting",
            title: "Waiting for triage",
            detail: request.isOwner
              ? "A maintenance reviewer will check your request. You can still cancel it while it is New."
              : "A maintenance reviewer needs to start the review."
          };
    case "UNDER_REVIEW":
      if (request.targetUnresolved && isActionAllowed(actions, "triage")) {
        return {
          tone: "blocked",
          title: "Confirm the maintenance target",
          detail: "Choose the machine, vehicle, or functional location before accepting this request."
        };
      }
      return isActionAllowed(actions, "approve") || isActionAllowed(actions, "close")
        ? { tone: "info", title: "Decision needed", detail: "Accept it for work, ask the requester a question, or close it." }
        : { tone: "waiting", title: "Under review", detail: "A maintenance reviewer is assessing this request." };
    case "NEEDS_INFORMATION":
      return isActionAllowed(actions, "respond")
        ? { tone: "blocked", title: "Your answer is needed", detail: "Reply to the reviewer's question below so review can continue." }
        : { tone: "waiting", title: "Waiting for the requester", detail: "The requester has been asked for more information." };
    case "APPROVED":
      return isActionAllowed(actions, "convert")
        ? { tone: "info", title: "Ready to become a work order", detail: "Convert it to create the work order with the confirmed target." }
        : { tone: "waiting", title: "Accepted", detail: "A planner will create the work order." };
    case "CONVERTED_TO_WO": {
      const progress = requesterFacingStatus(request.status, request.workOrder?.status);
      if (request.isOwner) {
        return {
          tone: progress === "Resolved / Completed" ? "done" : "waiting",
          title: progress,
          detail: request.workOrder
            ? `Linked work order ${request.workOrder.woNumber}. This is not a separate request.`
            : "A work order was created. Progress is shown once its status is available."
        };
      }
      return {
        tone: "done",
        title: request.workOrder ? `Work order ${request.workOrder.woNumber}` : "Converted to a work order",
        detail: "Progress continues on the work order."
      };
    }
    case "CLOSED":
      return { tone: "done", title: "Closed", detail: "No work order was created for this request." };
    case "CANCELLED":
      return { tone: "done", title: "Cancelled", detail: "This request was withdrawn." };
    default:
      return { tone: "info", title: requestStatusLabel(request.status), detail: "" };
  }
}

export type RequestStageCard = {
  stage: RequestStage;
  label: string;
  value: number;
};

/** Summary counters in display order; each links to the list stage with the same predicate. */
export function requestStageCards(summary: Pick<
  MaintenanceRequestSummary,
  "open" | "awaitingTriage" | "highCritical" | "converted"
>): RequestStageCard[] {
  return [
    { stage: "open", label: "Open", value: summary.open },
    { stage: "awaiting_triage", label: "Awaiting triage", value: summary.awaitingTriage },
    { stage: "urgent", label: "Open high / critical", value: summary.highCritical },
    { stage: "converted", label: "Converted to work orders", value: summary.converted }
  ];
}

export const REQUEST_STAGE_LABELS: Record<RequestStage, string> = {
  open: "Open",
  awaiting_triage: "Awaiting triage",
  urgent: "Open high / critical",
  converted: "Converted to work orders"
};

/**
 * Menu items navigate or run a command. Navigation must not depend on a Link
 * nested in a clickable table row, and the row click must not run as well.
 */
export function resolveRequestMenuActivation(action: { href?: string }): {
  closeMenu: true;
  navigateTo: string | null;
  runCommand: boolean;
} {
  return {
    closeMenu: true,
    navigateTo: action.href ?? null,
    runCommand: !action.href
  };
}

export function isRequestStage(value: string | null | undefined): value is RequestStage {
  return value === "open" || value === "awaiting_triage" || value === "urgent" || value === "converted";
}

/** List count line. A filtered total of 1 uses “matches”, not “match”. */
export function requestResultCountLabel(total: number, filtered: boolean) {
  const noun = total === 1 ? "request" : "requests";
  if (!filtered) return `${total} ${noun}`;
  const verb = total === 1 ? "matches" : "match";
  return `${total} ${noun} ${verb} this view`;
}
