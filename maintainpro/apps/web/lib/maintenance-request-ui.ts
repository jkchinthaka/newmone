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
  workOrder?: { woNumber: string } | null;
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
    case "CONVERTED_TO_WO":
      return {
        tone: "done",
        title: request.workOrder ? `Work order ${request.workOrder.woNumber}` : "Converted to a work order",
        detail: "Progress continues on the work order."
      };
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

export function isRequestStage(value: string | null | undefined): value is RequestStage {
  return value === "open" || value === "awaiting_triage" || value === "urgent" || value === "converted";
}
