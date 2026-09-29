import { apiClient } from "@/lib/api-client";

import type { WorkOrder, WorkOrderPriority, WorkOrderStatus } from "@/components/work-orders/types";

export type WorkOrderQueueKey =
  | "action-required"
  | "my-tasks"
  | "open-requests"
  | "approved-planned"
  | "assigned"
  | "in-progress"
  | "waiting-parts"
  | "waiting-evidence"
  | "technician-completed"
  | "supervisor-verification"
  | "rework-required"
  | "overdue"
  | "high-priority"
  | "high-risk"
  | "finance-vendor-pending"
  | "triage"
  | "completed"
  | "cancelled"
  | "all";

export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type WorkOrderActionRequiredItem = {
  type: string;
  label: string;
  actorRole?: string;
  severity: RiskSeverity;
};

export type WorkOrderQueueItem = WorkOrder & {
  riskScore?: number;
  riskSeverity?: RiskSeverity;
  actionRequired?: WorkOrderActionRequiredItem[];
  partsStatus?: string;
  evidenceStatus?: string;
  overdueDays?: number;
  primaryAssigneeName?: string | null;
  verificationStatus?: WorkOrder["verificationStatus"];
};

export type WorkOrderQueueSummary = {
  queues: Array<{ key: WorkOrderQueueKey; label: string; count: number }>;
  defaultQueue: WorkOrderQueueKey;
  summary?: {
    actionRequired: number;
    myTasks: number;
    waitingParts: number;
    waitingEvidence: number;
    supervisorVerification: number;
    highRisk: number;
    overdue: number;
    triage: number;
    highPriorityOpen: number;
    openUnassigned: number;
  };
  warnings?: Array<{ queue: string; message: string }>;
  lastUpdated: string;
};

export const FALLBACK_QUEUE_SUMMARY: WorkOrderQueueSummary = {
  queues: [
    { key: "action-required", label: "Action Required", count: 0 },
    { key: "my-tasks", label: "My Tasks", count: 0 },
    { key: "open-requests", label: "Open Requests", count: 0 },
    { key: "assigned", label: "Assigned", count: 0 },
    { key: "in-progress", label: "In Progress", count: 0 },
    { key: "waiting-parts", label: "Waiting Parts", count: 0 },
    { key: "waiting-evidence", label: "Waiting Evidence", count: 0 },
    { key: "supervisor-verification", label: "Supervisor Verification", count: 0 },
    { key: "overdue", label: "Overdue", count: 0 },
    { key: "high-priority", label: "High Priority", count: 0 },
    { key: "high-risk", label: "High Risk", count: 0 },
    { key: "triage", label: "Triage / Not Sure", count: 0 },
    { key: "completed", label: "Completed", count: 0 },
    { key: "cancelled", label: "Cancelled", count: 0 },
    { key: "all", label: "All", count: 0 }
  ],
  defaultQueue: "action-required",
  lastUpdated: new Date().toISOString()
};

export type WorkOrderQueueListResponse = {
  data: WorkOrderQueueItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
  queue: WorkOrderQueueKey;
  label: string;
  lastUpdated: string;
  summary?: {
    total: number;
    open: number;
    assigned: number;
    inProgress: number;
    overdue: number;
    highRisk: number;
    triage: number;
  };
  appliedFilters?: Record<string, unknown>;
  categorySummary?: Array<{
    categoryId?: string | null;
    categoryName: string;
    total: number;
    open: number;
    inProgress: number;
    overdue: number;
    highRisk: number;
    completed: number;
    cancelled: number;
    triage: number;
    evidenceMissing: number;
    partsPending: number;
    supervisorVerificationPending: number;
  }>;
};

export type WorkOrderQueueFilters = {
  queue: WorkOrderQueueKey;
  query: string;
  status: WorkOrderStatus | "ALL";
  priority: WorkOrderPriority | "ALL";
  overdueOnly: boolean;
  highRiskOnly: boolean;
  myAssignedOnly: boolean;
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDirection: "asc" | "desc";
  categoryId: string;
  typeId: string;
  issueId: string;
  triageOnly: boolean;
  smartView?: string;
};

export const DEFAULT_QUEUE_FILTERS: WorkOrderQueueFilters = {
  queue: "action-required",
  query: "",
  status: "ALL",
  priority: "ALL",
  overdueOnly: false,
  highRiskOnly: false,
  myAssignedOnly: false,
  dateFrom: "",
  dateTo: "",
  page: 1,
  pageSize: 25,
  sortBy: "operational",
  sortDirection: "desc",
  categoryId: "",
  typeId: "",
  issueId: "",
  triageOnly: false
};

interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T;
}

const QUEUE_LINK_STATUSES = new Set([
  "OPEN",
  "PLANNED",
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "TECHNICIAN_COMPLETED",
  "REWORK_REQUIRED",
  "VERIFIED",
  "CLOSED",
  "COMPLETED",
  "CANCELLED",
  "OVERDUE"
]);

const QUEUE_LINK_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export function isWorkOrderQueueKey(value: string): value is WorkOrderQueueKey {
  return (
    FALLBACK_QUEUE_SUMMARY.queues.some((queue) => queue.key === value) ||
    value === "rework-required" ||
    value === "finance-vendor-pending" ||
    value === "technician-completed" ||
    value === "approved-planned"
  );
}

/**
 * Turns a maintenance-dashboard work-order link into queue filters.
 * `smartView` and `status` are accepted because those are the links the dashboard already emits.
 */
export function queueFiltersFromSearch(params: {
  queue?: string | null;
  smartView?: string | null;
  status?: string | null;
  priority?: string | null;
}): Partial<WorkOrderQueueFilters> {
  const status = params.status && QUEUE_LINK_STATUSES.has(params.status) ? params.status : undefined;
  const priority =
    params.priority && QUEUE_LINK_PRIORITIES.has(params.priority) ? params.priority : undefined;
  const explicitQueue = params.queue && isWorkOrderQueueKey(params.queue) ? params.queue : undefined;
  const smartQueue =
    params.smartView && isWorkOrderQueueKey(params.smartView) ? params.smartView : undefined;

  let queue = explicitQueue ?? smartQueue;
  if (!queue && status === "OPEN") queue = "open-requests";
  if (!queue && (status === "IN_PROGRESS" || status === "ON_HOLD")) queue = "in-progress";
  if (!queue && status === "REWORK_REQUIRED") queue = "rework-required";
  if (!queue && status === "TECHNICIAN_COMPLETED") queue = "technician-completed";
  if (!queue && priority === "CRITICAL") queue = "high-priority";

  const patch: Partial<WorkOrderQueueFilters> = {};
  if (queue) patch.queue = queue;
  if (status) patch.status = status as WorkOrderQueueFilters["status"];
  if (priority) patch.priority = priority as WorkOrderQueueFilters["priority"];
  if (params.smartView) patch.smartView = params.smartView;
  return patch;
}

export async function fetchWorkOrderQueueSummary(): Promise<WorkOrderQueueSummary> {
  const response = await apiClient.get<ApiEnvelope<WorkOrderQueueSummary>>("/work-orders/queues");
  return unwrap(response.data);
}

export async function fetchWorkOrderQueue(
  filters: WorkOrderQueueFilters
): Promise<WorkOrderQueueListResponse> {
  const params = new URLSearchParams();
  params.set("queue", filters.queue);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  params.set("sortBy", filters.sortBy);
  params.set("sortDirection", filters.sortDirection);
  if (filters.status !== "ALL") params.set("status", filters.status);
  if (filters.priority !== "ALL") params.set("priority", filters.priority);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.overdueOnly) params.set("overdueOnly", "true");
  if (filters.highRiskOnly) params.set("highRiskOnly", "true");
  if (filters.myAssignedOnly) params.set("myAssignedOnly", "true");
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.typeId) params.set("typeId", filters.typeId);
  if (filters.issueId) params.set("issueId", filters.issueId);
  if (filters.triageOnly) params.set("triageOnly", "true");
  if (filters.query.trim().length >= 2) params.set("search", filters.query.trim());
  if (filters.smartView) params.set("smartView", filters.smartView);

  const response = await apiClient.get<ApiEnvelope<WorkOrderQueueListResponse>>(
    `/work-orders/queues/${filters.queue}?${params.toString()}`
  );
  return unwrap(response.data);
}

export async function fetchActionRequiredWorkOrders(
  filters: Pick<WorkOrderQueueFilters, "page" | "pageSize">
): Promise<WorkOrderQueueListResponse> {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize)
  });
  const response = await apiClient.get<ApiEnvelope<WorkOrderQueueListResponse>>(
    `/work-orders/action-required?${params.toString()}`
  );
  return unwrap(response.data);
}

export async function fetchSmartViews(): Promise<{
  views: Array<{ key: string; label: string; queueKey: WorkOrderQueueKey }>;
  defaultQueue: WorkOrderQueueKey;
}> {
  const response = await apiClient.get<
    ApiEnvelope<{
      views: Array<{ key: string; label: string; queueKey: WorkOrderQueueKey }>;
      defaultQueue: WorkOrderQueueKey;
    }>
  >("/work-orders/smart-views");
  return unwrap(response.data);
}
