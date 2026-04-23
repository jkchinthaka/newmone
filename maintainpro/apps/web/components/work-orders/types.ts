export const WORK_ORDER_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
  "OVERDUE"
] as const;

export const WORK_ORDER_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const WORK_ORDER_TYPES = [
  "PREVENTIVE",
  "CORRECTIVE",
  "EMERGENCY",
  "INSPECTION",
  "INSTALLATION"
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];
export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];
export type WorkOrderType = (typeof WORK_ORDER_TYPES)[number];
export type WorkOrderViewMode = "kanban" | "list";

export type WorkOrderSortField =
  | "woNumber"
  | "title"
  | "asset"
  | "status"
  | "priority"
  | "technician"
  | "dueDate"
  | "createdAt";

export type SortDirection = "asc" | "desc";

export interface UserReference {
  id: string;
  firstName: string;
  lastName: string;
  role?: {
    name?: string;
  } | null;
}

export interface WorkOrderAssetRef {
  id: string;
  name: string;
  assetTag?: string | null;
}

export interface WorkOrderVehicleRef {
  id: string;
  registrationNo: string;
  make?: string | null;
  vehicleModel?: string | null;
}

export interface WorkOrder {
  id: string;
  woNumber: string;
  title: string;
  description: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  type: WorkOrderType;
  assetId?: string | null;
  vehicleId?: string | null;
  scheduleId?: string | null;
  createdById: string;
  technicianId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  completedDate?: string | null;
  estimatedCost?: number | string | null;
  actualCost?: number | string | null;
  estimatedHours?: number | string | null;
  actualHours?: number | string | null;
  slaDeadline?: string | null;
  slaBreached: boolean;
  notes?: string | null;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
  asset?: WorkOrderAssetRef | null;
  vehicle?: WorkOrderVehicleRef | null;
  technician?: UserReference | null;
  createdBy?: UserReference | null;
}

export interface WorkOrderFilters {
  query: string;
  status: WorkOrderStatus | "ALL";
  priority: WorkOrderPriority | "ALL";
  technicianId: string | "ALL" | "UNASSIGNED";
  dueDateFrom: string;
  dueDateTo: string;
  sortBy: WorkOrderSortField;
  sortDirection: SortDirection;
}

export interface CreateWorkOrderInput {
  title: string;
  description: string;
  priority: WorkOrderPriority;
  type: WorkOrderType;
  createdById: string;
  assetId?: string;
  vehicleId?: string;
  scheduleId?: string;
  dueDate?: string;
}

export interface UpdateWorkOrderInput {
  title?: string;
  description?: string;
  dueDate?: string;
  estimatedCost?: number;
  estimatedHours?: number;
}

export interface UpdateWorkOrderStatusInput {
  status: WorkOrderStatus;
  actualCost?: number;
  actualHours?: number;
}

export interface TechnicianOption {
  id: string;
  fullName: string;
  roleName?: string;
}

export interface WorkOrdersApiResponse {
  data: WorkOrder[];
  message?: string;
}

export const STATUS_ORDER: WorkOrderStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
  "OVERDUE"
];

export const DEFAULT_WORK_ORDER_FILTERS: WorkOrderFilters = {
  query: "",
  status: "ALL",
  priority: "ALL",
  technicianId: "ALL",
  dueDateFrom: "",
  dueDateTo: "",
  sortBy: "createdAt",
  sortDirection: "desc"
};
