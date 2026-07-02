import type { WorkOrderQueueQuery } from "./work-order-queues.service";
import type { RiskSeverity } from "../../common/utils/maintenance-risk-score";
import type { WorkOrderQueueKey } from "../../common/utils/work-order-queues";

const QUEUE_ALIASES: Record<string, WorkOrderQueueKey> = {
  open: "open-requests"
};

export function normalizeWorkOrderQueueKey(queue?: string): WorkOrderQueueKey | undefined {
  if (!queue?.trim()) return undefined;
  const normalized = queue.trim() as WorkOrderQueueKey;
  return (QUEUE_ALIASES[normalized] ?? normalized) as WorkOrderQueueKey;
}

export function parseWorkOrderListQuery(raw: Record<string, string | undefined>): WorkOrderQueueQuery {
  const search = raw.search?.trim() || raw.query?.trim() || undefined;
  const queue = normalizeWorkOrderQueueKey(raw.queue);

  const query: WorkOrderQueueQuery = {
    queue,
    search,
    query: search,
    page: raw.page,
    pageSize: raw.pageSize,
    sortBy: raw.sortBy,
    sortDirection: raw.sortDirection === "asc" ? "asc" : raw.sortDirection === "desc" ? "desc" : undefined,
    status: raw.status,
    priority: raw.priority,
    dateFrom: raw.dateFrom,
    dateTo: raw.dateTo,
    dueFrom: raw.dueFrom,
    dueTo: raw.dueTo,
    departmentId: raw.departmentId,
    branchId: raw.branchId,
    assetId: raw.assetId,
    vehicleId: raw.vehicleId,
    employeeId: raw.assignedEmployeeId ?? raw.employeeId,
    requesterId: raw.requesterId,
    categoryId: raw.categoryId,
    taxonomyCategoryId: raw.taxonomyCategoryId,
    taxonomyTypeId: raw.taxonomyTypeId ?? raw.typeId,
    taxonomyIssueId: raw.taxonomyIssueId ?? raw.issueId,
    triageOnly: raw.triageOnly,
    riskSeverity: raw.riskSeverity as RiskSeverity | undefined,
    evidenceStatus: raw.evidenceStatus,
    partsStatus: raw.partsStatus,
    verificationStatus: raw.verificationStatus,
    overdueOnly: raw.overdueOnly,
    highRiskOnly: raw.highRiskOnly,
    myAssignedOnly: raw.myAssignedOnly,
    smartView: raw.smartView
  };

  applySmartViewDefaults(query, raw.smartView);
  return query;
}

function applySmartViewDefaults(query: WorkOrderQueueQuery, smartView?: string) {
  if (!smartView?.trim()) return;

  const view = smartView.trim();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  switch (view) {
    case "my-tasks":
      query.queue = "my-tasks";
      break;
    case "action-required":
      query.queue = "action-required";
      break;
    case "overdue":
      query.queue = "overdue";
      break;
    case "high-risk":
      query.queue = "high-risk";
      break;
    case "supervisor-verification":
      query.queue = "supervisor-verification";
      break;
    case "waiting-parts":
      query.queue = "waiting-parts";
      break;
    case "waiting-evidence":
      query.queue = "waiting-evidence";
      break;
    case "parts-pending-return":
      query.queue = "waiting-parts";
      query.partsStatus = "Pending return";
      break;
    case "rework-required":
      query.queue = "rework-required";
      break;
    case "triage":
      query.queue = "triage";
      query.triageOnly = true;
      break;
    case "completed-this-month":
      query.queue = "completed";
      query.dateFrom = startOfMonth.toISOString().slice(0, 10);
      break;
    case "cancelled-this-month":
      query.queue = "cancelled";
      query.dateFrom = startOfMonth.toISOString().slice(0, 10);
      break;
    case "created-today":
      query.dateFrom = startOfDay.toISOString();
      query.dateTo = endOfDay.toISOString();
      if (!query.queue) query.queue = "all";
      break;
    case "updated-today":
      query.updatedFrom = startOfDay.toISOString();
      query.updatedTo = endOfDay.toISOString();
      if (!query.queue) query.queue = "all";
      break;
    default:
      break;
  }
}

export function hasWorkOrderListParams(raw: Record<string, string | undefined>): boolean {
  const keys = Object.keys(raw).filter((key) => {
    const value = raw[key];
    return value !== undefined && String(value).trim() !== "";
  });
  return keys.length > 0;
}
