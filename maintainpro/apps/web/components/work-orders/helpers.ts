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
      };
    };
  };

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
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  }).format(date);
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
  const numeric = toNumber(value);
  if (numeric === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numeric);
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

  if (!order.dueDate) {
    return false;
  }

  const dueDate = new Date(order.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  return Date.now() > dueDate.getTime();
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
    OVERDUE: 4,
    COMPLETED: 5,
    CANCELLED: 6
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
