import {
  formatCurrency as formatCurrencyLk,
  formatDate as formatDateLk
} from "@/lib/localization";

import type {
  SortDirection,
  WorkOrder,
  WorkOrderPriority,
  WorkOrderSortField,
  WorkOrderStatus
} from "./types";

export function getErrorMessage(error: unknown): string {
  const fallback = "Something went wrong. Please try again.";

  if (!error || typeof error !== "object") {
    return fallback;
  }

  const maybeError = error as {
    message?: string;
    response?: {
      data?: {
        message?: string | string[];
        error?: {
          message?: string | string[];
        };
      };
    };
  };

  const nestedErrorMessage = maybeError.response?.data?.error?.message;
  if (Array.isArray(nestedErrorMessage) && nestedErrorMessage.length > 0) {
    return nestedErrorMessage.join(", ");
  }

  if (typeof nestedErrorMessage === "string" && nestedErrorMessage.trim()) {
    return nestedErrorMessage;
  }

  const responseMessage = maybeError.response?.data?.message;
  if (Array.isArray(responseMessage) && responseMessage.length > 0) {
    return responseMessage.join(", ");
  }

  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }

  if (typeof maybeError.message === "string" && maybeError.message.trim()) {
    return maybeError.message;
  }

  return fallback;
}

export function formatDate(value?: string | null): string {
  return formatDateLk(value, { fallback: "-" });
}

export function asDateInputValue(value?: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export function formatCurrency(value?: string | number | null): string {
  return formatCurrencyLk(value, { fallback: "-" });
}

export function toNumber(value?: string | number | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function getPriorityClass(priority: WorkOrderPriority): string {
  switch (priority) {
    case "CRITICAL":
      return "bg-rose-100 text-rose-700 ring-rose-200";
    case "HIGH":
      return "bg-amber-100 text-amber-800 ring-amber-200";
    case "MEDIUM":
      return "bg-sky-100 text-sky-700 ring-sky-200";
    case "LOW":
    default:
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
  }
}

export function getStatusClass(status: WorkOrderStatus): string {
  switch (status) {
    case "OPEN":
      return "bg-slate-200 text-slate-700 ring-slate-300";
    case "IN_PROGRESS":
      return "bg-sky-100 text-sky-700 ring-sky-200";
    case "ON_HOLD":
      return "bg-amber-100 text-amber-800 ring-amber-200";
    case "TECHNICIAN_COMPLETED":
      return "bg-violet-100 text-violet-800 ring-violet-200";
    case "REWORK_REQUIRED":
      return "bg-orange-100 text-orange-800 ring-orange-200";
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    case "CANCELLED":
      return "bg-slate-300 text-slate-700 ring-slate-400";
    case "OVERDUE":
    default:
      return "bg-rose-100 text-rose-700 ring-rose-200";
  }
}

export function toTitleCase(value: string): string {
  return value
    .split("_")
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1).toLowerCase())
    .join(" ");
}

export function getTechnicianName(order: WorkOrder): string {
  if (!order.technician) {
    return "Unassigned";
  }

  const fullName = `${order.technician.firstName ?? ""} ${order.technician.lastName ?? ""}`.trim();
  return fullName || "Unassigned";
}

export function getAssetLabel(order: WorkOrder): string {
  if (order.asset?.name) {
    return order.asset.assetTag ? `${order.asset.name} (${order.asset.assetTag})` : order.asset.name;
  }

  if (order.vehicle?.registrationNo) {
    return order.vehicle.registrationNo;
  }

  return "-";
}

export function isWorkOrderOverdue(order: WorkOrder): boolean {
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    return false;
  }

  if (order.status === "OVERDUE" || order.slaBreached) {
    return true;
  }

  const target = getWorkOrderCompletionTarget(order);
  if (!target) {
    return false;
  }

  return Date.now() > target.getTime();
}

export type WorkOrderDueUrgency = "OVERDUE" | "DUE_24H" | "DUE_3D" | "FUTURE" | "NONE";

export function getWorkOrderCompletionTarget(order: WorkOrder): Date | null {
  const raw =
    order.plannedEndAt ?? order.expectedCompletionDate ?? order.dueDate ?? null;
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getWorkOrderDueUrgency(order: WorkOrder): {
  level: WorkOrderDueUrgency;
  delayDays: number;
  target: Date | null;
} {
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    return { level: "NONE", delayDays: 0, target: null };
  }

  const target = getWorkOrderCompletionTarget(order);
  if (!target) {
    return { level: "NONE", delayDays: 0, target: null };
  }

  const ms = target.getTime() - Date.now();
  if (ms < 0) {
    return {
      level: "OVERDUE",
      delayDays: Math.ceil(Math.abs(ms) / (24 * 60 * 60 * 1000)),
      target
    };
  }

  const hours = ms / (60 * 60 * 1000);
  if (hours <= 24) {
    return { level: "DUE_24H", delayDays: 0, target };
  }

  const days = ms / (24 * 60 * 60 * 1000);
  if (days <= 3) {
    return { level: "DUE_3D", delayDays: 0, target };
  }

  return { level: "FUTURE", delayDays: 0, target };
}

export function getDueUrgencyClass(level: WorkOrderDueUrgency): string {
  switch (level) {
    case "OVERDUE":
      return "bg-rose-100 text-rose-800 ring-rose-200";
    case "DUE_24H":
      return "bg-orange-100 text-orange-800 ring-orange-200";
    case "DUE_3D":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    case "FUTURE":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export function getDueUrgencyLabel(level: WorkOrderDueUrgency, delayDays: number): string {
  switch (level) {
    case "OVERDUE":
      return delayDays > 0 ? `${delayDays}d overdue` : "Overdue";
    case "DUE_24H":
      return "Due within 24h";
    case "DUE_3D":
      return "Due within 3 days";
    case "FUTURE":
      return "On schedule";
    default:
      return "No target date";
  }
}

export function requiresAssetOrVehicle(type: WorkOrder["type"]): boolean {
  return type === "PREVENTIVE" || type === "INSPECTION" || type === "INSTALLATION";
}

/** Pre-start queue: only OPEN work orders belong on the Open board tab. */
export function isWorkOrderOpenTabStatus(status: WorkOrderStatus): boolean {
  return status === "OPEN";
}

/** Active execution queue: started or paused work belongs on the In Progress tab. */
export function isWorkOrderInProgressTabStatus(status: WorkOrderStatus): boolean {
  return (
    status === "IN_PROGRESS" ||
    status === "ON_HOLD" ||
    status === "TECHNICIAN_COMPLETED" ||
    status === "REWORK_REQUIRED"
  );
}

export function groupWorkOrdersByBoardTab(rows: WorkOrder[]): {
  open: WorkOrder[];
  inProgress: WorkOrder[];
  closed: WorkOrder[];
} {
  const open: WorkOrder[] = [];
  const inProgress: WorkOrder[] = [];
  const closed: WorkOrder[] = [];

  rows.forEach((order) => {
    if (isWorkOrderOpenTabStatus(order.status)) {
      open.push(order);
      return;
    }

    if (isWorkOrderInProgressTabStatus(order.status)) {
      inProgress.push(order);
      return;
    }

    closed.push(order);
  });

  return { open, inProgress, closed };
}

export function groupWorkOrdersByStatus(rows: WorkOrder[]): Record<WorkOrderStatus, WorkOrder[]> {
  const grouped = {
    OPEN: [] as WorkOrder[],
    IN_PROGRESS: [] as WorkOrder[],
    ON_HOLD: [] as WorkOrder[],
    TECHNICIAN_COMPLETED: [] as WorkOrder[],
    REWORK_REQUIRED: [] as WorkOrder[],
    COMPLETED: [] as WorkOrder[],
    CANCELLED: [] as WorkOrder[],
    OVERDUE: [] as WorkOrder[]
  };

  rows.forEach((order) => {
    const bucket = grouped[order.status];
    if (bucket) {
      bucket.push(order);
    }
  });

  grouped.IN_PROGRESS = [...grouped.IN_PROGRESS].sort((a, b) => {
    const aTarget = getWorkOrderCompletionTarget(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTarget = getWorkOrderCompletionTarget(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aTarget - bTarget;
  });

  return grouped;
}

export function compareWorkOrders(
  a: WorkOrder,
  b: WorkOrder,
  sortBy: WorkOrderSortField,
  sortDirection: SortDirection
): number {
  const direction = sortDirection === "asc" ? 1 : -1;

  const priorityRank: Record<WorkOrderPriority, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1
  };

  const statusRank: Record<WorkOrderStatus, number> = {
    OPEN: 1,
    IN_PROGRESS: 2,
    ON_HOLD: 3,
    TECHNICIAN_COMPLETED: 4,
    REWORK_REQUIRED: 5,
    OVERDUE: 6,
    COMPLETED: 7,
    CANCELLED: 8
  };

  const getDate = (value?: string | null) => {
    if (!value) {
      return 0;
    }

    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  let result = 0;

  switch (sortBy) {
    case "title":
      result = a.title.localeCompare(b.title);
      break;
    case "woNumber":
      result = a.woNumber.localeCompare(b.woNumber);
      break;
    case "asset":
      result = getAssetLabel(a).localeCompare(getAssetLabel(b));
      break;
    case "status":
      result = statusRank[a.status] - statusRank[b.status];
      break;
    case "priority":
      result = priorityRank[a.priority] - priorityRank[b.priority];
      break;
    case "technician":
      result = getTechnicianName(a).localeCompare(getTechnicianName(b));
      break;
    case "dueDate":
      result = getDate(a.dueDate) - getDate(b.dueDate);
      break;
    case "createdAt":
    default:
      result = getDate(a.createdAt) - getDate(b.createdAt);
      break;
  }

  return result * direction;
}
