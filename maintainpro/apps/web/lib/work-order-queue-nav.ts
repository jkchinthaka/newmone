import type { WorkOrderQueueFilters, WorkOrderQueueKey } from "./work-order-queues-api";

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
  completed: "Completed"
};

const MORE_ORDER = [
  "approved-planned",
  "waiting-evidence",
  "technician-completed",
  "rework-required",
  "unassigned",
  "open-load",
  "high-priority",
  "high-risk",
  "finance-vendor-pending",
  "triage",
  "cancelled",
  "all"
];

export type QueueTab = { key: WorkOrderQueueKey; label: string; count: number };

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
