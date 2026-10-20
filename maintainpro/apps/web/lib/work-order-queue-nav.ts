import type { WorkOrderQueueFilters, WorkOrderQueueKey } from "./work-order-queues-api";
import { DEFAULT_QUEUE_FILTERS } from "./work-order-queues-api";

/** Queues kept on the primary tab row. Other accessible queues go in More. */
export const PRIMARY_QUEUE_KEYS = [
  "action-required",
  "my-tasks",
  "open-requests",
  "assigned",
  "in-progress",
  "waiting-parts",
  "supervisor-verification",
  "overdue",
  "unassigned",
  "high-priority",
  "completed"
] as const;

const PRIMARY_LABELS: Record<string, string> = {
  "action-required": "Action Required",
  "my-tasks": "My Tasks",
  "open-requests": "Open",
  assigned: "Assigned",
  "in-progress": "In Progress",
  "waiting-parts": "Waiting Parts",
  "supervisor-verification": "Verification",
  overdue: "Overdue",
  unassigned: "Unassigned",
  "high-priority": "High Priority",
  completed: "Completed"
};

const MORE_ORDER = [
  "approved-planned",
  "waiting-evidence",
  "technician-completed",
  "rework-required",
  "open-load",
  "high-risk",
  "finance-vendor-pending",
  "triage",
  "cancelled",
  "all"
];

export type QueueTab = { key: WorkOrderQueueKey; label: string; count?: number };

export function splitQueueTabs(queues: QueueTab[]): { primary: QueueTab[]; more: QueueTab[] } {
  const byKey = new Map(queues.map((queue) => [queue.key, queue]));
  const primary = PRIMARY_QUEUE_KEYS.flatMap((key) => {
    const queue = byKey.get(key);
    if (!queue) return [];
    return [{ ...queue, label: PRIMARY_LABELS[key] ?? queue.label }];
  });
  const primaryKeys = new Set(primary.map((queue) => queue.key));
  const rest = queues.filter((queue) => !primaryKeys.has(queue.key));
  const more = [...rest].sort((left, right) => {
    const leftIndex = MORE_ORDER.indexOf(left.key);
    const rightIndex = MORE_ORDER.indexOf(right.key);
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });
  return { primary, more };
}

/** Plain-language meaning of a queue. Counts still come from the API. */
export function queuePurpose(key: string): string {
  switch (key) {
    case "action-required":
      return "Jobs that need a decision before work can continue.";
    case "waiting-parts":
      return "Jobs that are not finished and are waiting on parts.";
    case "supervisor-verification":
      return "Jobs waiting for a supervisor to verify the work.";
    case "overdue":
      return "Jobs past their due date.";
    case "unassigned":
      return "Open or planned jobs with no technician.";
    case "high-priority":
      return "Open jobs marked high or critical priority.";
    case "high-risk":
      return "Open jobs with a high risk score.";
    default:
      return "";
  }
}

export function formatRemainingDays(value: unknown): string {
  const days = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(days)) return "No due date";
  const whole = Math.round(days);
  if (whole === 0) return "Due today";
  if (whole === 1) return "Due in 1 day";
  if (whole === -1) return "1 day overdue";
  if (whole < 0) return `${Math.abs(whole)} days overdue`;
  return `Due in ${whole} days`;
}

export function formatQueueDue(
  dueDate: string | null | undefined,
  overdueDays?: number,
  now = new Date()
): { date: string; hint: string; overdue: boolean } {
  if (!dueDate) return { date: "No due date", hint: "", overdue: false };
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return { date: "No due date", hint: "", overdue: false };
  const date = due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (overdueDays && overdueDays > 0) {
    return { date, hint: `${overdueDays}d overdue`, overdue: true };
  }
  const day = 24 * 60 * 60 * 1000;
  const diff = Math.ceil((due.getTime() - now.getTime()) / day);
  if (diff < 0) return { date, hint: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { date, hint: "Due today", overdue: false };
  return { date, hint: `Due in ${diff}d`, overdue: false };
}

export function nextActionLabel(row: {
  actionRequired?: Array<{ label: string; severity?: string }>;
  partsStatus?: string | null;
  evidenceStatus?: string | null;
  status?: string;
}): { label: string; tone: "critical" | "warn" | "ok" | "neutral" } {
  const action = row.actionRequired?.[0];
  if (action?.label) {
    const severe = action.severity === "CRITICAL" || action.severity === "HIGH";
    return { label: action.label, tone: severe ? "critical" : "warn" };
  }
  if (row.partsStatus && !["None", "Issued"].includes(row.partsStatus)) {
    return { label: row.partsStatus === "Approval pending" ? "Approval pending" : "Waiting for parts", tone: "warn" };
  }
  if (row.evidenceStatus === "Missing" || row.evidenceStatus === "Rejected") {
    return { label: "Evidence missing", tone: "warn" };
  }
  if (row.status === "TECHNICIAN_COMPLETED") {
    return { label: "Verification required", tone: "warn" };
  }
  if (row.status === "COMPLETED" || row.status === "CLOSED" || row.status === "VERIFIED") {
    return { label: "Ready", tone: "ok" };
  }
  return { label: "Ready", tone: "neutral" };
}

export type QueueFilterChip = { key: string; label: string };

export function activeQueueFilterChips(filters: WorkOrderQueueFilters): QueueFilterChip[] {
  const chips: QueueFilterChip[] = [];
  if (filters.query.trim().length >= 2) chips.push({ key: "query", label: filters.query.trim() });
  if (filters.status !== "ALL") chips.push({ key: "status", label: filters.status.replaceAll("_", " ") });
  if (filters.priority !== "ALL") chips.push({ key: "priority", label: filters.priority });
  if (filters.technicianId) chips.push({ key: "technicianId", label: "Assignee" });
  if (filters.jobDomain) chips.push({ key: "jobDomain", label: filters.jobDomain });
  if (filters.overdueOnly) chips.push({ key: "overdueOnly", label: "Overdue" });
  if (filters.highRiskOnly) chips.push({ key: "highRiskOnly", label: "High risk" });
  if (filters.triageOnly) chips.push({ key: "triageOnly", label: "Triage" });
  if (filters.evidenceStatus) chips.push({ key: "evidenceStatus", label: `Evidence: ${filters.evidenceStatus}` });
  if (filters.partsStatus) chips.push({ key: "partsStatus", label: `Parts: ${filters.partsStatus}` });
  if (filters.dateFrom || filters.dateTo) {
    chips.push({ key: "dates", label: `Created ${filters.dateFrom || "…"}–${filters.dateTo || "…"}` });
  }
  if (filters.categoryId) chips.push({ key: "categoryId", label: "Category" });
  if (filters.smartView) chips.push({ key: "smartView", label: "Saved view" });
  if (filters.unassigned) chips.push({ key: "unassigned", label: "Unassigned" });
  return chips;
}

/** Patch that removes one active-filter chip. The queue tab stays selected. */
export function queueFiltersAfterChipRemove(
  key: string
): Partial<WorkOrderQueueFilters> {
  const page = { page: 1 } as const;
  switch (key) {
    case "query":
      return { query: "", ...page };
    case "status":
      return { status: "ALL", ...page };
    case "priority":
      return { priority: "ALL", ...page };
    case "technicianId":
      return { technicianId: "", ...page };
    case "jobDomain":
      return { jobDomain: undefined, ...page };
    case "overdueOnly":
      return { overdueOnly: false, ...page };
    case "highRiskOnly":
      return { highRiskOnly: false, ...page };
    case "triageOnly":
      return { triageOnly: false, ...page };
    case "evidenceStatus":
      return { evidenceStatus: "", ...page };
    case "partsStatus":
      return { partsStatus: "", ...page };
    case "dates":
      return { dateFrom: "", dateTo: "", ...page };
    case "categoryId":
      return { categoryId: "", ...page };
    case "smartView":
      return { smartView: undefined, ...page };
    case "unassigned":
      return { unassigned: false, ...page };
    default:
      return page;
  }
}

/**
 * Same defaults as the API `resolveDefaultQueueForRole`. The jobs page uses this
 * so the first list request does not wait for the summary response.
 */
export function defaultWorkOrderQueueForRole(role: string | null | undefined): WorkOrderQueueKey {
  if (role === "TECHNICIAN" || role === "MECHANIC") return "my-tasks";
  if (role === "SUPERVISOR" || role === "SECURITY_OFFICER") return "supervisor-verification";
  if (role === "INVENTORY_KEEPER") return "waiting-parts";
  if (
    role === "MANAGER" ||
    role === "OPERATIONS_MANAGER" ||
    role === "ASSET_MANAGER" ||
    role === "FLEET_MANAGER" ||
    role === "SUPER_ADMIN" ||
    role === "ADMIN"
  ) {
    return "action-required";
  }
  return "my-tasks";
}

/** Mirrors API `roleCanAccessQueue`. The server still rejects a forbidden queue. */
export function queueAllowedForRole(role: string | null | undefined, queue: WorkOrderQueueKey): boolean {
  if (
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "MANAGER" ||
    role === "OPERATIONS_MANAGER" ||
    role === "ASSET_MANAGER" ||
    role === "FLEET_MANAGER" ||
    role === "SUPERVISOR" ||
    role === "SECURITY_OFFICER"
  ) {
    return true;
  }
  if (role === "INVENTORY_KEEPER") {
    return ["waiting-parts", "my-tasks", "action-required", "assigned", "in-progress", "unassigned", "open-load"].includes(queue);
  }
  if (role === "TECHNICIAN" || role === "MECHANIC") {
    return !["all", "finance-vendor-pending", "supervisor-verification", "high-priority"].includes(queue);
  }
  return queue !== "all";
}

/** URL state for the queue board. A missing or forbidden queue uses the role default and is not written back. */
export function resolvedQueueFilters(
  linked: Partial<WorkOrderQueueFilters>,
  role: string | null | undefined,
  options?: { jobDomain?: string }
): WorkOrderQueueFilters {
  const roleDefault = defaultWorkOrderQueueForRole(role);
  const requested = linked.queue;
  const queue = requested && queueAllowedForRole(role, requested) ? requested : roleDefault;
  return {
    ...DEFAULT_QUEUE_FILTERS,
    ...linked,
    queue,
    query: linked.query ?? "",
    status: linked.status ?? DEFAULT_QUEUE_FILTERS.status,
    priority: linked.priority ?? DEFAULT_QUEUE_FILTERS.priority,
    unassigned: Boolean(linked.unassigned),
    overdueOnly: Boolean(linked.overdueOnly),
    highRiskOnly: Boolean(linked.highRiskOnly),
    triageOnly: Boolean(linked.triageOnly),
    dateFrom: linked.dateFrom ?? "",
    dateTo: linked.dateTo ?? "",
    categoryId: linked.categoryId ?? "",
    technicianId: linked.technicianId ?? "",
    evidenceStatus: linked.evidenceStatus ?? "",
    partsStatus: linked.partsStatus ?? "",
    page: linked.page ?? 1,
    pageSize: linked.pageSize ?? DEFAULT_QUEUE_FILTERS.pageSize,
    jobDomain: options?.jobDomain || linked.jobDomain
  };
}

/**
 * Keeps text the user is still editing. A URL echo of the same words, including a
 * trailing space, must not replace the field. A different URL query is navigation.
 */
export function shouldKeepLocalSearch(input: {
  local: string;
  urlQuery: string;
  echoedQuery: string | null;
  typingSinceEcho: boolean;
}): boolean {
  if (input.local.trim() === input.urlQuery) return true;
  return input.typingSinceEcho && input.echoedQuery === input.urlQuery;
}

/**
 * Visible draft and the debounce-committed query.
 * `issuedId` is the latest publication this visit has written.
 * `settledThrough` is the newest publication whose URL has been seen, or that an
 * external navigation has superseded. Older ids stay stale; the query text does not.
 */
export type SearchSyncState = {
  draft: string;
  committed: string;
  editing: boolean;
  issuedId: number;
  settledThrough: number;
  issuedQuery: string;
};

export function createSearchSync(query = ""): SearchSyncState {
  return {
    draft: query,
    committed: query,
    editing: false,
    issuedId: 0,
    settledThrough: 0,
    issuedQuery: query.trim()
  };
}

export function noteSearchDraft(state: SearchSyncState, draft: string): SearchSyncState {
  return { ...state, draft, editing: true };
}

/** Debounce commit. Issues a new publication id for the trimmed draft. */
export function commitSearchDraft(state: SearchSyncState): SearchSyncState {
  const trimmed = state.draft.trim();
  if (!state.editing && state.committed === state.draft && state.issuedQuery === trimmed) {
    return state;
  }
  return {
    ...state,
    committed: state.draft,
    editing: false,
    issuedId: state.issuedId + 1,
    issuedQuery: trimmed
  };
}

export type AppliedSearchUrl = {
  state: SearchSyncState;
  /** Null keeps the visible field. */
  draft: string | null;
  /** Null keeps the committed query. A stale echo must not write either. */
  committed: string | null;
  stale: boolean;
};

function adoptSearchUrl(state: SearchSyncState, urlQuery: string): AppliedSearchUrl {
  const sameText = state.draft === urlQuery || (state.draft.trim() === urlQuery && !state.editing);
  const next: SearchSyncState = {
    ...state,
    draft: sameText ? state.draft : urlQuery,
    committed: sameText ? state.committed : urlQuery,
    editing: false,
    issuedQuery: urlQuery,
    settledThrough: Math.max(state.settledThrough, state.issuedId)
  };
  return {
    state: next,
    draft: sameText ? null : urlQuery,
    committed: sameText ? null : urlQuery,
    stale: false
  };
}

/**
 * Applies one URL query.
 * A `qRev` lower than or equal to a settled publication is an old replace completing
 * late, and it is ignored. A URL without that id, or a browser Back/Forward event,
 * is navigation and replaces the field.
 */
export function applySearchUrl(
  state: SearchSyncState,
  urlQuery: string,
  options?: { publicationId?: number | null; fromHistory?: boolean }
): AppliedSearchUrl {
  const publicationId = options?.publicationId ?? null;
  if (options?.fromHistory) {
    return adoptSearchUrl(state, urlQuery);
  }

  const superseded =
    publicationId !== null &&
    publicationId > 0 &&
    (publicationId < state.issuedId || publicationId <= state.settledThrough);
  if (superseded && publicationId !== state.issuedId) {
    return { state, draft: null, committed: null, stale: true };
  }

  const echo = publicationId !== null && publicationId > 0 && publicationId === state.issuedId;
  const keep =
    echo ||
    shouldKeepLocalSearch({
      local: state.draft,
      urlQuery,
      echoedQuery: state.issuedQuery,
      typingSinceEcho: state.editing
    });
  if (keep) {
    const next = echo ? { ...state, settledThrough: Math.max(state.settledThrough, publicationId) } : state;
    return { state: next, draft: null, committed: null, stale: false };
  }

  return adoptSearchUrl(state, urlQuery);
}

function sameQueueFilters(current: WorkOrderQueueFilters, next: WorkOrderQueueFilters): boolean {
  return (
    current.queue === next.queue &&
    current.status === next.status &&
    current.priority === next.priority &&
    current.query === next.query &&
    current.page === next.page &&
    current.pageSize === next.pageSize &&
    current.smartView === next.smartView &&
    Boolean(current.unassigned) === Boolean(next.unassigned) &&
    current.overdueOnly === next.overdueOnly &&
    current.highRiskOnly === next.highRiskOnly &&
    current.triageOnly === next.triageOnly &&
    current.dateFrom === next.dateFrom &&
    current.dateTo === next.dateTo &&
    current.categoryId === next.categoryId &&
    (current.technicianId ?? "") === (next.technicianId ?? "") &&
    (current.evidenceStatus ?? "") === (next.evidenceStatus ?? "") &&
    (current.partsStatus ?? "") === (next.partsStatus ?? "") &&
    (current.jobDomain ?? "") === (next.jobDomain ?? "")
  );
}

/**
 * URL effect used by the work-order queue panel.
 * A kept draft is not copied into the committed query; only the debounce does that.
 */
export function reduceWorkOrderSearchUrl(input: {
  sync: SearchSyncState;
  current: WorkOrderQueueFilters;
  linked: Partial<WorkOrderQueueFilters>;
  role: string | null | undefined;
  jobDomain?: string;
  publicationId?: number | null;
  fromHistory?: boolean;
}): { sync: SearchSyncState; draft: string | null; filters: WorkOrderQueueFilters | null } {
  const next = resolvedQueueFilters(input.linked, input.role, { jobDomain: input.jobDomain });
  const applied = applySearchUrl(input.sync, next.query, {
    publicationId: input.publicationId,
    fromHistory: input.fromHistory
  });
  if (applied.stale) {
    return { sync: applied.state, draft: null, filters: null };
  }
  const query = applied.committed ?? input.current.query;
  const filters = { ...next, query };
  if (sameQueueFilters(input.current, filters)) {
    return { sync: applied.state, draft: applied.draft, filters: null };
  }
  return { sync: applied.state, draft: applied.draft, filters };
}

export function queuesVisibleToRole<T extends { key: WorkOrderQueueKey }>(
  queues: T[],
  role: string | null | undefined
): T[] {
  return queues.filter((queue) => queueAllowedForRole(role, queue.key));
}

/**
 * Returns the next query string when the URL must change.
 * Adding only the role's default queue is skipped: that replace was causing a
 * failed RSC fetch and a full document reload on every Work Orders open.
 */
export function queueSearchReplaceTarget(
  current: URLSearchParams,
  filters: WorkOrderQueueFilters,
  defaultQueue: WorkOrderQueueKey
): string | null {
  const next = new URLSearchParams(current.toString());
  writeQueueFiltersToSearch(next, filters);
  if (next.toString() === current.toString()) return null;
  if (!current.has("queue") && next.get("queue") === defaultQueue) {
    const withoutQueue = new URLSearchParams(next.toString());
    withoutQueue.delete("queue");
    if (withoutQueue.toString() === current.toString()) return null;
  }
  return next.toString();
}

/** Writes the queue board state into the page URL without dropping unrelated params such as `wo`. */
export function writeQueueFiltersToSearch(params: URLSearchParams, filters: WorkOrderQueueFilters) {
  params.set("queue", filters.queue);
  params.delete("filter");
  setOrDelete(params, "status", filters.status !== "ALL" ? filters.status : "");
  setOrDelete(params, "priority", filters.priority !== "ALL" ? filters.priority : "");
  setOrDelete(params, "q", filters.query.trim());
  setOrDelete(params, "overdueOnly", filters.overdueOnly ? "true" : "");
  setOrDelete(params, "highRiskOnly", filters.highRiskOnly ? "true" : "");
  setOrDelete(params, "triageOnly", filters.triageOnly ? "true" : "");
  setOrDelete(params, "dateFrom", filters.dateFrom);
  setOrDelete(params, "dateTo", filters.dateTo);
  setOrDelete(params, "categoryId", filters.categoryId);
  setOrDelete(params, "technicianId", filters.technicianId ?? "");
  setOrDelete(params, "evidenceStatus", filters.evidenceStatus ?? "");
  setOrDelete(params, "partsStatus", filters.partsStatus ?? "");
  setOrDelete(params, "smartView", filters.smartView ?? "");
  setOrDelete(params, "jobDomain", filters.jobDomain ?? "");
  setOrDelete(params, "unassigned", filters.unassigned ? "true" : "");
  if (filters.page > 1) params.set("page", String(filters.page));
  else params.delete("page");
  if (filters.pageSize !== 25) params.set("pageSize", String(filters.pageSize));
  else params.delete("pageSize");
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}
