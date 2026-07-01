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
  | "high-risk"
  | "finance-vendor-pending"
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
  lastUpdated: string;
};

export type WorkOrderQueueListResponse = {
  data: WorkOrderQueueItem[];
  total: number;
  page: number;
  pageSize: number;
  queue: WorkOrderQueueKey;
  label: string;
  lastUpdated: string;
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
  sortDirection: "desc"
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
