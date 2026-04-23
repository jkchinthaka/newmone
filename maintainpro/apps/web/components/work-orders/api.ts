import { apiClient } from "@/lib/api-client";

import type {
  CreateWorkOrderInput,
  TechnicianOption,
  UpdateWorkOrderInput,
  UpdateWorkOrderStatusInput,
  UserReference,
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType
} from "./types";

interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

const validStatuses = new Set<WorkOrderStatus>([
  "OPEN",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
  "OVERDUE"
]);

const validPriorities = new Set<WorkOrderPriority>(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const validTypes = new Set<WorkOrderType>([
  "PREVENTIVE",
  "CORRECTIVE",
  "EMERGENCY",
  "INSPECTION",
  "INSTALLATION"
]);

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiEnvelope<T>).data;
  }

  return payload as T;
}

function sanitizeUser(raw: unknown): UserReference | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.id !== "string") {
    return null;
  }

  return {
    id: candidate.id,
    firstName: typeof candidate.firstName === "string" ? candidate.firstName : "",
    lastName: typeof candidate.lastName === "string" ? candidate.lastName : "",
    role: candidate.role && typeof candidate.role === "object" ? (candidate.role as { name?: string }) : null
  };
}

function sanitizeWorkOrder(raw: unknown): WorkOrder {
  const candidate = (raw ?? {}) as Record<string, unknown>;

  const priority = typeof candidate.priority === "string" && validPriorities.has(candidate.priority as WorkOrderPriority)
    ? (candidate.priority as WorkOrderPriority)
    : "MEDIUM";

  const status = typeof candidate.status === "string" && validStatuses.has(candidate.status as WorkOrderStatus)
    ? (candidate.status as WorkOrderStatus)
    : "OPEN";

  const type = typeof candidate.type === "string" && validTypes.has(candidate.type as WorkOrderType)
    ? (candidate.type as WorkOrderType)
    : "CORRECTIVE";

  return {
    id: String(candidate.id ?? ""),
    woNumber: String(candidate.woNumber ?? "WO-UNKNOWN"),
    title: String(candidate.title ?? "Untitled work order"),
    description: String(candidate.description ?? ""),
    priority,
    status,
    type,
    assetId: typeof candidate.assetId === "string" ? candidate.assetId : null,
    vehicleId: typeof candidate.vehicleId === "string" ? candidate.vehicleId : null,
    scheduleId: typeof candidate.scheduleId === "string" ? candidate.scheduleId : null,
    createdById: String(candidate.createdById ?? ""),
    technicianId: typeof candidate.technicianId === "string" ? candidate.technicianId : null,
    dueDate: typeof candidate.dueDate === "string" ? candidate.dueDate : null,
    startDate: typeof candidate.startDate === "string" ? candidate.startDate : null,
    completedDate: typeof candidate.completedDate === "string" ? candidate.completedDate : null,
    estimatedCost: typeof candidate.estimatedCost === "number" || typeof candidate.estimatedCost === "string" ? candidate.estimatedCost : null,
    actualCost: typeof candidate.actualCost === "number" || typeof candidate.actualCost === "string" ? candidate.actualCost : null,
    estimatedHours: typeof candidate.estimatedHours === "number" || typeof candidate.estimatedHours === "string" ? candidate.estimatedHours : null,
    actualHours: typeof candidate.actualHours === "number" || typeof candidate.actualHours === "string" ? candidate.actualHours : null,
    slaDeadline: typeof candidate.slaDeadline === "string" ? candidate.slaDeadline : null,
    slaBreached: Boolean(candidate.slaBreached),
    notes: typeof candidate.notes === "string" ? candidate.notes : null,
    attachments: Array.isArray(candidate.attachments)
      ? candidate.attachments.filter((item): item is string => typeof item === "string")
      : [],
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString(),
    asset: candidate.asset && typeof candidate.asset === "object"
      ? {
          id: String((candidate.asset as Record<string, unknown>).id ?? ""),
          name: String((candidate.asset as Record<string, unknown>).name ?? "Unknown asset"),
          assetTag:
            typeof (candidate.asset as Record<string, unknown>).assetTag === "string"
              ? String((candidate.asset as Record<string, unknown>).assetTag)
              : null
        }
      : null,
    vehicle: candidate.vehicle && typeof candidate.vehicle === "object"
      ? {
          id: String((candidate.vehicle as Record<string, unknown>).id ?? ""),
          registrationNo: String((candidate.vehicle as Record<string, unknown>).registrationNo ?? "Unknown vehicle"),
          make:
            typeof (candidate.vehicle as Record<string, unknown>).make === "string"
              ? String((candidate.vehicle as Record<string, unknown>).make)
              : null,
          vehicleModel:
            typeof (candidate.vehicle as Record<string, unknown>).vehicleModel === "string"
              ? String((candidate.vehicle as Record<string, unknown>).vehicleModel)
              : null
        }
      : null,
    technician: sanitizeUser(candidate.technician),
    createdBy: sanitizeUser(candidate.createdBy)
  };
}

export async function fetchWorkOrders(): Promise<WorkOrder[]> {
  const response = await apiClient.get<ApiEnvelope<WorkOrder[]>>("/work-orders");
  const rows = unwrapData<unknown[]>(response.data);

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => sanitizeWorkOrder(row));
}

export async function createWorkOrder(payload: CreateWorkOrderInput): Promise<WorkOrder> {
  const response = await apiClient.post<ApiEnvelope<WorkOrder>>("/work-orders", payload);
  return sanitizeWorkOrder(unwrapData(response.data));
}

export async function updateWorkOrder(id: string, payload: UpdateWorkOrderInput): Promise<WorkOrder> {
  const response = await apiClient.patch<ApiEnvelope<WorkOrder>>(`/work-orders/${id}`, payload);
  return sanitizeWorkOrder(unwrapData(response.data));
}

export async function deleteWorkOrder(id: string): Promise<void> {
  await apiClient.delete(`/work-orders/${id}`);
}

export async function updateWorkOrderStatus(id: string, payload: UpdateWorkOrderStatusInput): Promise<WorkOrder> {
  const response = await apiClient.patch<ApiEnvelope<WorkOrder>>(`/work-orders/${id}/status`, payload);
  return sanitizeWorkOrder(unwrapData(response.data));
}

export async function assignWorkOrder(id: string, technicianId: string): Promise<WorkOrder> {
  const response = await apiClient.post<ApiEnvelope<WorkOrder>>(`/work-orders/${id}/assign`, { technicianId });
  return sanitizeWorkOrder(unwrapData(response.data));
}

export async function fetchTechnicians(): Promise<TechnicianOption[]> {
  try {
    const response = await apiClient.get<ApiEnvelope<Array<Record<string, unknown>>>>("/users");
    const rows = unwrapData<Array<Record<string, unknown>>>(response.data);

    if (!Array.isArray(rows)) {
      return [];
    }

    const blockedRoles = new Set(["DRIVER", "VIEWER"]);

    return rows
      .filter((user) => typeof user.id === "string")
      .filter((user) => {
        const roleName =
          user.role && typeof user.role === "object" && typeof (user.role as Record<string, unknown>).name === "string"
            ? String((user.role as Record<string, unknown>).name)
            : "";

        return !blockedRoles.has(roleName);
      })
      .map((user) => {
        const firstName = typeof user.firstName === "string" ? user.firstName : "";
        const lastName = typeof user.lastName === "string" ? user.lastName : "";
        const roleName =
          user.role && typeof user.role === "object" && typeof (user.role as Record<string, unknown>).name === "string"
            ? String((user.role as Record<string, unknown>).name)
            : undefined;

        return {
          id: String(user.id),
          fullName: `${firstName} ${lastName}`.trim() || String(user.email ?? user.id),
          roleName
        };
      });
  } catch {
    return [];
  }
}

export async function bulkDeleteWorkOrders(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => deleteWorkOrder(id)));
}

export async function bulkUpdateStatus(
  ids: string[],
  status: WorkOrderStatus,
  payload?: { actualCost?: number; actualHours?: number }
): Promise<WorkOrder[]> {
  const updated = await Promise.all(
    ids.map((id) =>
      updateWorkOrderStatus(id, {
        status,
        actualCost: payload?.actualCost,
        actualHours: payload?.actualHours
      })
    )
  );

  return updated;
}
